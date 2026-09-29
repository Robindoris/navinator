import { app, safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { DEFAULT_SETTINGS, type AppSettings, type ServerProfile, type ServerProfileInput } from '@shared/types'

/** On-disk shape. Passwords are ciphertext unless the OS keyring is missing. */
interface StoredServer {
  id: string
  name: string
  url: string
  username: string
  /** `enc:<base64>` when OS-encrypted, `plain:<base64>` otherwise, or null. */
  secret: string | null
  secretIsEncrypted: boolean
  isAdmin: boolean
  lastUsedAt: number | null
}

interface PersistedState {
  version: number
  servers: StoredServer[]
  activeServerId: string | null
  settings: AppSettings
}

const STATE_VERSION = 1

function emptyState(): PersistedState {
  return {
    version: STATE_VERSION,
    servers: [],
    activeServerId: null,
    settings: structuredClone(DEFAULT_SETTINGS)
  }
}

/**
 * Normalises whatever the user pasted into a usable origin.
 *
 * People copy `music.example.com`, `http://box:4533/` and
 * `https://music.example.com/subsonic` interchangeably, so we add the scheme
 * when missing, drop trailing slashes, and preserve any path prefix because
 * Navidrome is frequently mounted under a sub-path by a reverse proxy.
 */
export function normaliseServerUrl(input: string): string {
  let raw = input.trim()
  if (!raw) throw new Error('Enter a server address')
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`"${input}" is not a valid address`)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Server address must start with http:// or https://')
  }
  // Subsonic endpoints live under /rest, so the base is the origin plus prefix.
  const path = url.pathname.replace(/\/+$/, '')
  return `${url.protocol}//${url.host}${path}`
}

/** Human label for a server when the user has not named it. */
function defaultName(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

function mergeSettings(base: AppSettings, patch: unknown): AppSettings {
  if (!patch || typeof patch !== 'object') return base
  const incoming = patch as Partial<AppSettings> & { audio?: Partial<AppSettings['audio']> }
  return {
    ...base,
    ...incoming,
    audio: { ...base.audio, ...(incoming.audio ?? {}) }
  }
}

class ConfigStore {
  private state: PersistedState = emptyState()
  private file = ''
  private saveTimer: NodeJS.Timeout | null = null

  init(): void {
    this.file = join(app.getPath('userData'), 'navinator.json')
    mkdirSync(dirname(this.file), { recursive: true })
    this.state = this.read()
  }

  private read(): PersistedState {
    if (!this.file || !existsSync(this.file)) return emptyState()
    try {
      const parsed = JSON.parse(readFileSync(this.file, 'utf8')) as Partial<PersistedState>
      const base = emptyState()
      return {
        version: STATE_VERSION,
        servers: Array.isArray(parsed.servers) ? parsed.servers : [],
        activeServerId: parsed.activeServerId ?? null,
        settings: mergeSettings(base.settings, parsed.settings)
      }
    } catch {
      // A corrupt config must never stop the app from launching.
      return emptyState()
    }
  }

  /** Debounced so rapid-fire mutations do not thrash the disk. */
  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => this.saveNow(), 200)
  }

  saveNow(): void {
    if (!this.file || this.saveTimer) {
      if (this.saveTimer) {
        clearTimeout(this.saveTimer)
        this.saveTimer = null
      }
      if (!this.file) return
    }
    try {
      const tmp = `${this.file}.tmp`
      writeFileSync(tmp, JSON.stringify(this.state, null, 2), { encoding: 'utf8', mode: 0o600 })
      // Atomic swap so a crash mid-write cannot truncate the real config.
      renameSync(tmp, this.file)
    } catch {
      /* Best effort: losing persistence is preferable to crashing playback. */
    }
  }

  /** Clears the stored password for a server (used on sign-out). */
  forgetPassword(id: string): void {
    const server = this.state.servers.find((s) => s.id === id)
    if (!server) return
    server.secret = null
    server.secretIsEncrypted = false
    this.scheduleSave()
  }

  /* ------------------------------------------------------------- profiles */

  listProfiles(): ServerProfile[] {
    return [...this.state.servers]
      .sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0))
      .map((s) => this.toPublic(s))
  }

  private toPublic(s: StoredServer): ServerProfile {
    return {
      id: s.id,
      name: s.name,
      url: s.url,
      username: s.username,
      hasPassword: s.secret !== null,
      isAdmin: s.isAdmin,
      lastUsedAt: s.lastUsedAt
    }
  }

  getActiveId(): string | null {
    return this.state.activeServerId
  }

  setActiveId(id: string | null): void {
    this.state.activeServerId = id
    if (id) {
      const server = this.state.servers.find((s) => s.id === id)
      if (server) server.lastUsedAt = Date.now()
    }
    this.scheduleSave()
  }

  upsertProfile(input: ServerProfileInput): ServerProfile[] {
    const url = normaliseServerUrl(input.url)
    const existing = input.id
      ? this.state.servers.find((s) => s.id === input.id)
      : this.state.servers.find((s) => s.url === url && s.username === input.username)

    if (existing) {
      existing.url = url
      existing.username = input.username
      if (input.name) existing.name = input.name
      if (input.password) {
        existing.secret = ConfigStore.encrypt(input.password)
        existing.secretIsEncrypted = existing.secret.startsWith('enc:')
      } else if (input.keepPassword === false) {
        existing.secret = null
        existing.secretIsEncrypted = false
      }
    } else {
      const secret = input.password ? ConfigStore.encrypt(input.password) : null
      this.state.servers.push({
        id: input.id ?? randomUUID(),
        name: input.name || defaultName(url),
        url,
        username: input.username,
        secret,
        secretIsEncrypted: secret?.startsWith('enc:') ?? false,
        isAdmin: false,
        lastUsedAt: Date.now()
      })
    }
    this.scheduleSave()
    return this.listProfiles()
  }

  removeProfile(id: string): ServerProfile[] {
    this.state.servers = this.state.servers.filter((s) => s.id !== id)
    if (this.state.activeServerId === id) this.state.activeServerId = null
    this.scheduleSave()
    return this.listProfiles()
  }

  renameProfile(id: string, name: string): ServerProfile[] {
    const server = this.state.servers.find((s) => s.id === id)
    if (server && name.trim()) {
      server.name = name.trim()
      this.scheduleSave()
    }
    return this.listProfiles()
  }

  setAdmin(id: string, isAdmin: boolean): void {
    const server = this.state.servers.find((s) => s.id === id)
    if (server) {
      server.isAdmin = isAdmin
      this.scheduleSave()
    }
  }

  /* ------------------------------------------------------------ secrets */

  getCredentials(id: string): { url: string; username: string; password: string } | null {
    const server = this.state.servers.find((s) => s.id === id)
    if (!server) return null
    const password = server.secret ? ConfigStore.decrypt(server.secret) : ''
    return { url: server.url, username: server.username, password: password ?? '' }
  }

  /** Verifies whether the OS provided a usable keyring. */
  private static encrypt(plain: string): string {
    try {
      if (safeStorage.isEncryptionAvailable()) {
        return `enc:${safeStorage.encryptString(plain).toString('base64')}`
      }
    } catch {
      /* fall through to the plain marker below */
    }
    return `plain:${Buffer.from(plain, 'utf8').toString('base64')}`
  }

  private static decrypt(stored: string): string | null {
    try {
      if (stored.startsWith('enc:')) {
        if (!safeStorage.isEncryptionAvailable()) return null
        return safeStorage.decryptString(Buffer.from(stored.slice(4), 'base64'))
      }
      if (stored.startsWith('plain:')) {
        return Buffer.from(stored.slice(6), 'base64').toString('utf8')
      }
    } catch {
      return null
    }
    return null
  }

  /* ----------------------------------------------------------- settings */

  getSettings(): AppSettings {
    return structuredClone(this.state.settings)
  }

  patchSettings(patch: unknown): AppSettings {
    this.state.settings = mergeSettings(this.state.settings, patch)
    this.scheduleSave()
    return this.getSettings()
  }

  resetSettings(): AppSettings {
    this.state.settings = structuredClone(DEFAULT_SETTINGS)
    this.scheduleSave()
    return this.getSettings()
  }
}

export const config = new ConfigStore()

/**
 * True when the OS provides a real keyring for credential encryption.
 *
 * On Linux with no secret service, Electron falls back to encrypting with a
 * hardcoded password, which is security theatre — callers use this to warn the
 * user rather than to silently store weak protection.
 */
export function isEncryptionAvailable(): boolean {
  try {
    if (!safeStorage.isEncryptionAvailable()) return false
    // Linux only: identify the backend so `basic_text` can be reported as unsafe.
    const backend = safeStorage.getSelectedStorageBackend?.()
    if (backend === 'basic_text' || backend === 'unknown') return false
    return true
  } catch {
    return false
  }
}

