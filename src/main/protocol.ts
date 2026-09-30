import { net, protocol } from 'electron'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { MEDIA_HOST, NAVIGATOR_SCHEME } from '@shared/media'
import { connection } from './server'

/** Host that serves the renderer bundle, distinct from the media host. */
const APP_HOST = 'app'

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8'
}

/** Headers worth relaying back to Chromium from the upstream response. */
const RELAYED_HEADERS = [
  'content-type',
  'content-length',
  'content-range',
  'accept-ranges',
  'etag',
  'last-modified',
  'cache-control',
  'expires'
] as const

/**
 * Vite names every emitted asset with a content hash (`index-BRFLEVLV.js`), so
 * a changed byte always means a changed name. Those are immutable and can be
 * cached indefinitely; only `index.html` can point at a different hash and must
 * be revalidated.
 */
const HASHED_ASSET = /-[A-Za-z0-9_-]{8}\.[a-z0-9]+$/

function errorResponse(message: string, status = 502): Response {
  return new Response(message, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8' }
  })
}

/**
 * Serves the built renderer from `navinator://app/`.
 *
 * Loading over `file://` is explicitly discouraged by Electron's security
 * checklist, and it also breaks the renderer's Content-Security-Policy: a
 * `file://` document has an opaque (`null`) origin, so `'self'` in
 * `script-src` matches nothing and every script gets blocked.
 *
 * A separate host keeps the app and the media proxy on different origins, so
 * media responses are never treated as same-origin script sources.
 */
function serveAppAsset(pathname: string): Promise<Response> {
  const root = resolve(join(__dirname, '..', 'renderer'))
  const relative = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, '')
  const target = resolve(join(root, relative === '' ? 'index.html' : relative))

  // Path traversal guard: the resolved file must stay inside the bundle.
  if (target !== root && !target.startsWith(root + sep)) {
    return Promise.resolve(errorResponse('Forbidden', 403))
  }

  const extension = extname(target).toLowerCase()

  // `no-cache` without a validator still forces a full re-read, so hashed assets
  // get a real long-lived cache entry and only the HTML entry point pays for a
  // revalidation on every launch.
  const cacheControl = HASHED_ASSET.test(relative)
    ? 'public, max-age=31536000, immutable'
    : 'no-cache'

  return readFile(target).then(
    (body) =>
      new Response(new Uint8Array(body), {
        status: 200,
        headers: {
          'content-type': CONTENT_TYPES[extension] ?? 'application/octet-stream',
          'cache-control': cacheControl
        }
      }),
    () => errorResponse('Not found', 404)
  )
}

/**
 * Must run before `app.whenReady()`. `stream: true` is essential — without it
 * `<audio>` buffers responses and the gapless preloader stalls.
 */
export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: NAVIGATOR_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        corsEnabled: true,
        bypassCSP: false
      }
    }
  ])
}

/**
 * Proxies audio and artwork from the Navidrome server to the renderer.
 *
 * The renderer addresses media as
 * `navinator://media/<kind>?<params>`; this handler resolves the real upstream
 * URL (including the salted auth token) in the main process and relays the
 * body. The renderer therefore never holds a credential, never needs CORS, and
 * the request is issued through `net.fetch` so the system proxy and trust
 * store still apply.
 */
export function registerMediaProtocol(): void {
  protocol.handle(NAVIGATOR_SCHEME, async (request) => {
    let url: URL
    try {
      url = new URL(request.url)
    } catch {
      return errorResponse('Malformed media URL', 400)
    }

    // Only our own two namespaces are served.
    if (url.hostname === APP_HOST) return serveAppAsset(url.pathname)
    if (url.hostname !== MEDIA_HOST) return errorResponse('Not found', 404)

    const kind = url.pathname.replace(/^\/+/, '')
    const id = url.searchParams.get('id') ?? ''
    const size = url.searchParams.get('size')

    if (!connection.isConnected()) return errorResponse('Not connected to a server', 503)

    let upstream: string
    try {
      switch (kind) {
        case 'song': {
          if (!id) return errorResponse('Missing track id', 400)
          const transcode = url.searchParams.get('transcode') === '1'
          const timeOffsetRaw = url.searchParams.get('timeOffset')
          upstream = await connection.buildStreamUrl(id, {
            // `maxBitRate`/`format` are only meaningful when transcoding.
            transcode,
            maxBitRate: transcode ? Number(url.searchParams.get('maxBitRate')) || undefined : undefined,
            format: transcode ? (url.searchParams.get('format') ?? undefined) : undefined,
            timeOffset: timeOffsetRaw ? Number(timeOffsetRaw) : undefined
          })
          break
        }
        case 'download': {
          if (!id) return errorResponse('Missing track id', 400)
          upstream = await connection.buildDownloadUrl(id)
          break
        }
        case 'cover': {
          if (!id) return errorResponse('Missing cover id', 400)
          upstream = await connection.buildCoverArtUrl(id, size ? Number(size) : undefined)
          break
        }
        case 'avatar': {
          upstream = await connection.buildAvatarUrl(url.searchParams.get('username') ?? '', size ? Number(size) : undefined)
          break
        }
        case 'radio': {
          if (!id) return errorResponse('Missing station id', 400)
          // Resolved against the server's own station list, never taken from the
          // page — see `resolveStationUrl` for why that matters.
          upstream = await connection.resolveStationUrl(id)
          break
        }
        default:
          return errorResponse('Unknown media kind', 404)
      }
    } catch (error) {
      return errorResponse(error instanceof Error ? error.message : 'Cannot resolve media URL', 500)
    }

    // Forward the client's range request so seeking works against the server
    // rather than forcing a full-body buffer.
    const headers: Record<string, string> = {}
    const range = request.headers.get('range')
    if (range) headers.Range = range
    const ifNoneMatch = request.headers.get('if-none-match')
    if (ifNoneMatch) headers['If-None-Match'] = ifNoneMatch

    let response: Response
    try {
      response = await net.fetch(upstream, { headers, bypassCustomProtocolHandlers: true })
    } catch (error) {
      return errorResponse(error instanceof Error ? error.message : 'Upstream request failed', 502)
    }

    const isAudio = kind === 'song' || kind === 'download' || kind === 'radio'

    const out = new Headers()
    for (const name of RELAYED_HEADERS) {
      // Audio is re-fetched on every play and must never be reused from cache,
      // otherwise seeking and track changes read stale bytes.
      if (name === 'cache-control' && isAudio) continue
      const value = response.headers.get(name)
      if (value) out.set(name, value)
    }

    if (isAudio) {
      out.set('cache-control', 'no-store')
    } else if (!out.has('cache-control')) {
      // Cover ids are content addressed (Navidrome appends an image hash), so
      // they are safe to keep indefinitely and Chromium will cache them.
      out.set('cache-control', 'public, max-age=31536000, immutable')
    }
    if (!out.has('accept-ranges')) out.set('accept-ranges', 'bytes')

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: out
    })
  })
}
