import { createHash, randomBytes } from 'node:crypto'
import SubsonicAPI from 'subsonic-api'
import { isApiMethod } from '@shared/api-methods'
import type { SongUrlOptions } from '@shared/media'
import type {
  ConnectionInfo,
  ProbeResult,
  ServerExtension,
  ServerProfile,
  ServerProfileInput
} from '@shared/types'
import { config, normaliseServerUrl } from './config'

/** API version advertised to the server. Matches `subsonic-api`. */
const API_VERSION = '1.16.1'
const CLIENT_NAME = 'navinator'

/** Subsonic error code for "wrong username or password". */
const ERROR_BAD_CREDENTIALS = 40

/**
 * The fields the handshake adds on top of the base response.
 *
 * Every one is optional: a plain Subsonic server omits `type`/`serverVersion`
 * entirely, and only an OpenSubsonic server reports them.
 */
interface ServerHandshake {
  version?: string
  type?: string
  serverVersion?: string
  openSubsonic?: boolean
}

/**
 * `format` arrives straight out of a URL query in `protocol.ts`, so the trusted
 * layer — not the caller — is what narrows it to a codec the server accepts.
 */
type StreamUrlRequest = Omit<SongUrlOptions, 'format'> & { format?: string }

/**
 * `subsonic-api` only exposes URL builders for `stream` and `getCoverArt`, but
 * downloads and avatars have to be fetched by the main process too. They go
 * through the identical salted-token scheme, built here so the URL we hand to
 * `net.fetch` never contains the raw password.
 */
interface MediaEndpoint {
  method: string
  params: Record<string, string | number | undefined>
}

const DISCONNECTED: ConnectionInfo = {
  state: 'disconnected',
  profile: null,
  serverVersion: null,
  apiVersion: null,
  serverType: null,
  openSubsonic: false,
  extensions: [],
  error: null
}

interface ActiveConnection {
  api: SubsonicAPI
  profile: ServerProfile
  salt: string
  token: string
  info: ConnectionInfo
}

/** Subsonic salted token: `md5(password + salt)`, hex encoded. */
function authToken(password: string, salt: string): string {
  return createHash('md5').update(password + salt).digest('hex')
}

function newSalt(): string {
  // Subsonic only allows alphanumerics in the salt.
  return randomBytes(8).toString('hex')
}

/** Turns an unknown throw into a sentence worth showing a user. */
function describeError(error: unknown): string {
  if (error instanceof Error) {
    // Node surfaces a dead host as a bare system message; give it a subject.
    if (error.cause && typeof (error.cause as { message?: string }).message === 'string') {
      return `Cannot reach the server: ${(error.cause as { message: string }).message}`
    }
    return error.message || 'The request failed'
  }
  return typeof error === 'string' ? error : 'The request failed'
}

function isUnauthorised(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes(String(ERROR_BAD_CREDENTIALS)) || /credential|password|unauthor/i.test(message)
}

/**
 * Owns the single live connection to a Subsonic server.
 *
 * The renderer never holds credentials, so every authenticated call is issued
 * from here and streamed back as plain data. Only one server is connected at a
 * time; switching tears the previous client down first.
 */
class Connection {
  private current: ActiveConnection | null = null
  private info: ConnectionInfo = DISCONNECTED

  /** Notified whenever connection state changes, so the renderer can resync. */
  private onChange: (info: ConnectionInfo) => void = () => {}

  setChangeListener(listener: (info: ConnectionInfo) => void): void {
    this.onChange = listener
  }

  getInfo(): ConnectionInfo {
    return this.info
  }

  isConnected(): boolean {
    return this.current !== null
  }

  private publish(next: ConnectionInfo): ConnectionInfo {
    this.info = next
    this.onChange(next)
    return next
  }

  private failed(profile: ServerProfile | null, error: unknown): ConnectionInfo {
    return this.publish({
      ...DISCONNECTED,
      state: 'error',
      profile,
      error: describeError(error)
    })
  }

  /* ------------------------------------------------------------- lifecycle */

  /**
   * Verifies credentials without establishing a session.
   *
   * Used by the connect form before anything is written to disk, so a typo in
   * the URL or username is caught while the user is still looking at the form.
   */
  async probe(input: ServerProfileInput): Promise<ProbeResult> {
    const result: ProbeResult = {
      ok: false,
      error: null,
      serverVersion: null,
      serverType: null,
      openSubsonic: false,
      unauthorised: false
    }

    let api: SubsonicAPI
    try {
      api = this.createClient(normaliseServerUrl(input.url), input.username, input.password ?? '')
    } catch (error) {
      return { ...result, error: describeError(error) }
    }

    try {
      const response = await api.ping()
      if (response.status === 'failed') {
        return {
          ...result,
          error: response.error.message ?? 'The server rejected the request',
          unauthorised: response.error.code === ERROR_BAD_CREDENTIALS
        }
      }
      return {
        ok: true,
        error: null,
        serverVersion: Connection.readServerVersion(response),
        serverType: Connection.readServerType(response),
        openSubsonic: response.openSubsonic === true,
        unauthorised: false
      }
    } catch (error) {
      if (isUnauthorised(error)) {
        return { ...result, error: 'Incorrect username or password', unauthorised: true }
      }
      return { ...result, error: describeError(error) }
    }
  }

  /**
   * Connects to a stored profile.
   *
   * Never throws for a connection-level failure: the renderer's connect flow
   * reads `state`/`error` off the returned info rather than catching, so a
   * rejected login is a normal return value here.
   */
  async connect(id: string): Promise<ConnectionInfo> {
    const credentials = config.getCredentials(id)
    if (!credentials) {
      return this.failed(null, new Error('That server is no longer available'))
    }

    const profile = config.listProfiles().find((p) => p.id === id) ?? null
    if (!profile) return this.failed(null, new Error('That server is no longer available'))

    this.publish({ ...DISCONNECTED, state: 'connecting', profile })

    const salt = newSalt()
    let api: SubsonicAPI
    try {
      api = this.createClient(credentials.url, credentials.username, credentials.password, salt)
    } catch (error) {
      return this.failed(profile, error)
    }

    try {
      const response = await api.ping()
      if (response.status === 'failed') {
        return this.failed(
          profile,
          new Error(
            response.error.code === ERROR_BAD_CREDENTIALS
              ? 'Incorrect username or password'
              : (response.error.message ?? 'The server rejected the request')
          )
        )
      }

      const extensions = await this.readExtensions(api)
      const isAdmin = await this.readIsAdmin(api, credentials.username)

      // Only mark the profile active once it genuinely works, so a failed
      // reconnect never leaves the app pointing at a dead server on next boot.
      config.setAdmin(profile.id, isAdmin)
      config.setActiveId(profile.id)

      const refreshed = config.listProfiles().find((p) => p.id === profile.id) ?? profile

      this.current = {
        api,
        profile: refreshed,
        salt,
        token: authToken(credentials.password, salt),
        info: DISCONNECTED
      }

      const info: ConnectionInfo = {
        state: 'connected',
        profile: refreshed,
        serverVersion: Connection.readServerVersion(response),
        apiVersion: response.version ?? null,
        serverType: Connection.readServerType(response),
        openSubsonic: response.openSubsonic === true,
        extensions,
        error: null
      }
      this.current.info = info
      return this.publish(info)
    } catch (error) {
      this.current = null
      if (isUnauthorised(error)) {
        return this.failed(profile, new Error('Incorrect username or password'))
      }
      return this.failed(profile, error)
    }
  }

  async disconnect(): Promise<void> {
    this.current = null
    this.publish(DISCONNECTED)
  }

  /**
   * Re-reads the live profile from disk.
   *
   * Editing the name or address of the connected server should not require a
   * reconnect, but the media proxy signs every URL with the cached copy, so it
   * has to be kept current.
   */
  refreshProfile(profile: ServerProfile): void {
    if (!this.current || this.current.profile.id !== profile.id) return
    this.current.profile = profile
    this.publish({ ...this.current.info, profile })
  }

  /**
   * Re-opens the last used server on launch. Failure is silent by design: the
   * renderer falls back to the connect screen and reports the error there.
   */
  async restore(): Promise<ConnectionInfo> {
    const activeId = config.getActiveId()
    if (!activeId) return DISCONNECTED
    try {
      return await this.connect(activeId)
    } catch {
      return this.getInfo()
    }
  }

  /* --------------------------------------------------------------- requests */

  /**
   * Forwards one allow-listed Subsonic call.
   *
   * The method name arrives from the renderer as an untrusted string, so it is
   * re-validated here: without this a compromised renderer could reach any
   * member of the client, including the ones the bridge has no business
   * exposing.
   */
  async request(method: string, params?: unknown[]): Promise<unknown> {
    if (!isApiMethod(method)) throw new Error(`Unknown API method: ${method}`)

    const active = this.current
    if (!active) throw new Error('Not connected to a server')

    const fn = (active.api as unknown as Record<string, unknown>)[method]
    if (typeof fn !== 'function') {
      throw new Error(`This server does not support ${method}`)
    }

    const result = await (fn as (...args: unknown[]) => Promise<unknown>).apply(
      active.api,
      params ?? []
    )

    // Raw media endpoints return a `Response`, which cannot cross the IPC
    // boundary. The renderer addresses media through the proxy scheme instead.
    if (result instanceof Response) {
      throw new Error(`${method} returns binary media and must be requested through navinator://`)
    }

    return result
  }

  /* ------------------------------------------------------------ media URLs */

  private endpointUrl(endpoint: MediaEndpoint): string {
    const active = this.current
    if (!active) throw new Error('Not connected to a server')

    const base = active.api.baseURL()
    const url = new URL(`${base}rest/${endpoint.method}.view`)

    url.searchParams.set('v', API_VERSION)
    url.searchParams.set('c', CLIENT_NAME)
    url.searchParams.set('f', 'json')
    url.searchParams.set('u', active.profile.username)
    url.searchParams.set('t', active.token)
    url.searchParams.set('s', active.salt)

    for (const [key, value] of Object.entries(endpoint.params)) {
      if (value === undefined || value === '') continue
      url.searchParams.set(key, String(value))
    }
    return url.toString()
  }

  /**
   * `opus` is our own name for what the protocol calls `ogg`; translating here
   * keeps the shared `StreamFormat` vocabulary independent of the client.
   * Anything unrecognised is dropped rather than forwarded, so a hand-edited
   * media URL cannot make the server fail the request.
   */
  private static transcodeFormat(format: string | undefined): 'raw' | 'mp3' | 'ogg' | 'aac' | undefined {
    switch (format) {
      case 'raw':
      case 'mp3':
      case 'aac':
        return format
      case 'opus':
        return 'ogg'
      default:
        return undefined
    }
  }

  async buildStreamUrl(id: string, options: StreamUrlRequest = {}): Promise<string> {
    const active = this.current
    if (!active) throw new Error('Not connected to a server')

    const format = Connection.transcodeFormat(options.format)
    const maxBitRate = options.maxBitRate && options.maxBitRate > 0 ? options.maxBitRate : undefined

    // `subsonic-api` builds these correctly (including POST-mode servers, where
    // it has to force a GET), so prefer its builder over our own.
    return active.api.streamURL({
      id,
      ...(options.transcode ? { maxBitRate, format } : {}),
      ...(options.timeOffset ? { timeOffset: options.timeOffset } : {})
    })
  }

  async buildDownloadUrl(id: string): Promise<string> {
    return this.endpointUrl({ method: 'download', params: { id } })
  }

  async buildCoverArtUrl(id: string, size?: number): Promise<string> {
    const active = this.current
    if (!active) throw new Error('Not connected to a server')
    return active.api.getCoverArtURL({ id, ...(size ? { size } : {}) })
  }

  async buildAvatarUrl(username: string, size?: number): Promise<string> {
    return this.endpointUrl({
      method: 'getAvatar',
      params: { username, ...(size ? { size } : {}) }
    })
  }

  /* --------------------------------------------------------------- helpers */

  private createClient(url: string, username: string, password: string, salt = newSalt()): SubsonicAPI {
    return new SubsonicAPI({
      url,
      auth: { username, password },
      // One salt per client keeps token generation cheap; the same salt is what
      // the hand-built media URLs above are signed with.
      salt,
      reuseSalt: true
    })
  }

  /** OpenSubsonic is optional, so a rejection here is not a failure. */
  private async readExtensions(api: SubsonicAPI): Promise<ServerExtension[]> {
    try {
      const response = await api.getOpenSubsonicExtensions()
      if (response.status === 'failed') return []
      return (response.openSubsonicExtensions ?? []) as ServerExtension[]
    } catch {
      return []
    }
  }

  private async readIsAdmin(api: SubsonicAPI, username: string): Promise<boolean> {
    try {
      const response = await api.getUser({ username })
      if (response.status === 'failed') return false
      return response.user?.adminRole === true
    } catch {
      return false
    }
  }

  private static readServerVersion(response: ServerHandshake): string | null {
    return response.serverVersion || response.version || null
  }

  private static readServerType(response: ServerHandshake): string | null {
    return response.type || null
  }
}

export const connection = new Connection()
