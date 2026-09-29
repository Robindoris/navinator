import type { AudioSettings, Song, StreamFormat } from './types'

/**
 * Custom privileged scheme used to proxy audio and artwork out of the main
 * process.
 *
 * The renderer never talks to the Navidrome host directly. Every byte of audio
 * and every cover image is fetched by the main process and handed to Chromium
 * through this scheme. That buys us three things at once:
 *
 *  - no CORS dependency (self-hosted Navidrome is often behind a reverse proxy
 *    that does not forward `Access-Control-*` headers),
 *  - credentials and stream tokens never reach renderer-visible URLs,
 *  - `net.fetch` gives us real streaming plus byte-range support, so seeking
 *    and gapless preloading work.
 */
export const NAVIGATOR_SCHEME = 'navinator'

/** Host segment distinguishes the `media` namespace from future schemes. */
export const MEDIA_HOST = 'media'

export type MediaKind = 'song' | 'cover' | 'avatar' | 'download' | 'radio'

export interface SongUrlOptions {
  transcode?: boolean
  /** kbps, ignored when `transcode` is false. 0 means "no limit". */
  maxBitRate?: number
  format?: StreamFormat
  jukebox?: boolean
  /** Seconds to skip into the source, used with the `transcodeOffset` extension. */
  timeOffset?: number
}

/**
 * Container/codec suffixes that Chromium can decode natively, and which
 * therefore never need a server-side transcode.
 *
 * Getting this wrong is expensive in both directions: transcoding a 24-bit
 * FLAC to 320 kbps MP3 throws away detail and burns CPU on the server, and
 * asking a server to transcode a stream it cannot seek produces a response
 * with no `Content-Length`, which breaks the seek bar entirely.
 */
const CHROMIUM_DECODABLE = new Set([
  'mp3',
  'aac',
  'm4a',
  'm4b',
  'mp4',
  'oga',
  'ogg',
  'opus',
  'spx',
  'flac',
  'wav',
  'wave',
  'webm',
  'weba',
  'mka'
])

/**
 * Decides how a given song should be fetched.
 *
 * The server is only asked to transcode when Chromium genuinely cannot play
 * the file, which keeps quality lossless for the overwhelming majority of
 * libraries while still making exotic formats (WMA, APE, ALAC, DSD…) work.
 */
export function resolveStreamOptions(
  song: Pick<Song, 'suffix'>,
  audio: Pick<AudioSettings, 'transcode' | 'maxBitRate' | 'format'>
): SongUrlOptions {
  if (!audio.transcode) return { transcode: false }

  const suffix = (song.suffix ?? '').toLowerCase()
  // Unknown suffix: assume it plays. Forcing a transcode on every track
  // because one field is missing would be far more disruptive.
  if (!suffix || CHROMIUM_DECODABLE.has(suffix)) return { transcode: false }

  return {
    transcode: true,
    maxBitRate: audio.maxBitRate > 0 ? audio.maxBitRate : undefined,
    format: audio.format !== 'raw' ? audio.format : undefined
  }
}

function mediaUrl(kind: MediaKind, params: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(`${NAVIGATOR_SCHEME}://${MEDIA_HOST}/${kind}`)
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue
    url.searchParams.set(key, String(value))
  }
  return url.toString()
}

/** Streamable URL for a song. Consumed by the `<audio>` element. */
export function songMediaUrl(id: string, options: SongUrlOptions = {}): string {
  return mediaUrl('song', {
    id,
    transcode: options.transcode ? '1' : undefined,
    maxBitRate: options.maxBitRate || undefined,
    format: options.format && options.format !== 'raw' ? options.format : undefined,
    jukebox: options.jukebox ? '1' : undefined,
    timeOffset: options.timeOffset || undefined
  })
}

/** Raw-file download URL. */
export function downloadMediaUrl(id: string): string {
  return mediaUrl('download', { id })
}

/**
 * Internet radio stream.
 *
 * A station has no Subsonic id, so the main process resolves the real URL from
 * the server's own station list rather than trusting one from the page — see
 * `protocol.ts`. The id here is the station's id, not a track id.
 */
export function radioMediaUrl(stationId: string): string {
  return mediaUrl('radio', { id: stationId })
}

/** Cover art URL. Ids are content addressed, so responses are cacheable. */
export function coverMediaUrl(id: string | undefined, size = 512): string {
  if (!id) return placeholderCoverDataUrl()
  return mediaUrl('cover', { id, size })
}

/** User avatar; falls back to a placeholder served by Navidrome. */
export function avatarMediaUrl(username: string | undefined): string {
  return mediaUrl('avatar', { username: username ?? '' })
}

/** Neutral placeholder so `<img>` always has a valid source. */
export function placeholderCoverDataUrl(): string {
  return (
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
        <rect width="300" height="300" fill="#1c1c22"/>
        <circle cx="150" cy="150" r="62" fill="none" stroke="#3a3a46" stroke-width="6"/>
        <circle cx="150" cy="150" r="14" fill="#3a3a46"/>
      </svg>`
    )
  )
}
