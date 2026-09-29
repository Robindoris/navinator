/**
 * Types shared across the main, preload and renderer processes.
 *
 * This module must stay free of runtime dependencies on Electron or the DOM so
 * that it can be type-checked for every process target.
 */

import { DEFAULT_ACCENT, type AccentTheme } from './themes'

/* ------------------------------------------------------------------ servers */

export interface ServerProfile {
  id: string
  /** User facing label, defaults to the host name. */
  name: string
  /** Normalised origin, e.g. `https://music.example.com`. */
  url: string
  username: string
  /** True when a password is stored for this profile. */
  hasPassword: boolean
  isAdmin: boolean
  lastUsedAt: number | null
}

export interface ServerProfileInput {
  id?: string
  name?: string
  url: string
  username: string
  password?: string
  /** Used when updating so the stored password can be left untouched. */
  keepPassword?: boolean
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface ServerExtension {
  name: string
  versions: number[]
}

export interface ConnectionInfo {
  state: ConnectionState
  profile: ServerProfile | null
  /** Populated once connected. */
  serverVersion: string | null
  apiVersion: string | null
  serverType: string | null
  openSubsonic: boolean
  extensions: ServerExtension[]
  /** Populated when `state === 'error'`. */
  error: string | null
}

export interface ProbeResult {
  ok: boolean
  /** Reason the probe failed, already phrased for humans. */
  error: string | null
  serverVersion: string | null
  serverType: string | null
  openSubsonic: boolean
  /** True when the server responded but rejected the credentials. */
  unauthorised: boolean
}

/* ------------------------------------------------------------------ settings */

export type ThemeMode = 'dark' | 'light' | 'system'
export type RepeatMode = 'off' | 'all' | 'one'
export type StreamFormat = 'raw' | 'opus' | 'mp3' | 'aac'

export interface AudioSettings {
  /** Ask the server to transcode when the source format is unsupported. */
  transcode: boolean
  /** Maximum bitrate in kbps, or 0 for "no limit" (stream the original). */
  maxBitRate: number
  format: StreamFormat
  /** Use the two-deck engine so albums play without a gap. */
  gapless: boolean
  /** Crossfade duration in milliseconds, 0 disables crossfade. */
  crossfade: number
  volume: number
  muted: boolean
  jukebox: boolean
  scrobble: boolean
  /** Report play counts back to the server. */
  playbackReport: boolean
}

export interface AppSettings {
  theme: ThemeMode
  /** Colour palette, independent of `theme`. See `ACCENT_THEMES`. */
  accent: AccentTheme
  showCoverArtInSidebar: boolean
  compactAlbumGrid: boolean
  confirmOnQuit: boolean
  startMinimized: boolean
  /** Check for application updates automatically on launch. */
  autoUpdate: boolean
  audio: AudioSettings
}

export interface AppInfo {
  version: string
  platform: NodeJS.Platform | string
  isPackaged: boolean
  encryptionAvailable: boolean
}

/* ------------------------------------------------------------------- library */

export interface Song {
  id: string
  parent?: string
  isDir?: boolean
  title: string
  album?: string
  artist?: string
  track?: number
  discNumber?: number
  year?: number
  genre?: string
  coverArt?: string
  size?: number
  contentType?: string
  suffix?: string
  duration?: number
  bitRate?: number
  path?: string
  isVideo?: boolean
  userRating?: number
  averageRating?: number
  /** ISO timestamp when starred, absent otherwise. */
  starred?: string
  playCount?: number
  played?: string
  created?: string
  albumId?: string
  artistId?: string
  /** Navidrome/OpenSubsonic lyrics, present when the `songLyrics` extension is on. */
  lyrics?: string
  bookmarkPosition?: number
  /**
   * Internet radio.
   *
   * A station is not a library track — it has no Subsonic song id, no duration
   * and no scrobble target — but it has to be queueable, so it is carried in the
   * same shape. The player and the queue check `isRadio` and skip every
   * annotation the server cannot accept.
   */
  isRadio?: boolean
  /** The station's own id, used to resolve the stream through the media proxy. */
  streamUrl?: string
  homePageUrl?: string
}

export interface Album {
  id: string
  name: string
  artist?: string
  artistId?: string
  coverArt?: string
  songCount?: number
  duration?: number
  playCount?: number
  created?: string
  year?: number
  genre?: string
  played?: string
  userRating?: number
  averageRating?: number
  /** ISO timestamp when starred, absent otherwise. */
  starred?: string
  isCompilation?: boolean
  songList?: Song[]
  genres?: { name: string }[]
  artists?: { id: string; name: string }[]
  displayArtist?: string
  musicBrainzId?: string
  sortName?: string
  versions?: Album[]
  releaseDate?: Record<string, number>
  /** Populated client side when grouping multi-disc albums. */
  discs?: AlbumDisc[]
}

export interface AlbumDisc {
  discNumber: number
  title: string
  songs: Song[]
}

export interface Artist {
  id: string
  name: string
  coverArt?: string
  albumCount?: number
  artistImageUrl?: string
  sortName?: string
  starred?: string
  userRating?: number
  averageRating?: number
}

export interface ArtistIndex {
  name: string
  artist: Artist[]
}

export interface Genre {
  value: string
  songCount?: number
  albumCount?: number
  coverArt?: string
  artistCount?: number
}

export interface Playlist {
  id: string
  name: string
  comment?: string
  owner?: string
  public?: boolean
  songCount?: number
  duration?: number
  coverArt?: string
  created?: string
  changed?: string
}

export interface Playlists {
  playlist: Playlist[]
}

export interface MusicFolder {
  id: number
  name: string
}

export interface Bookmarks {
  bookmark: {
    position: number
    username: string
    comment: string
    created: string
    entry: Song
  }[]
}

export interface PlayQueue {
  current?: string
  position?: number
  username: string
  changed?: string
  changedBy?: string
  entry: Song[]
}

export interface ScanStatus {
  scanning: boolean
  count: number
  /** Navidrome extension. */
  lastScan?: string
  folderCount?: number
}

export interface InternetRadioStation {
  id: string
  name: string
  streamUrl: string
  homePageUrl?: string
}

export interface User {
  username: string
  email?: string
  firstName?: string
  lastName?: string
  roles: string[]
  maxBitRate?: number
  scrobblingEnabled?: boolean
  adminRole: boolean
  settingsRole: boolean
  downloadRole: boolean
  uploadRole: boolean
  playlistRole: boolean
  coverArtRole: boolean
  commentRole: boolean
  podcastRole: boolean
  streamRole: boolean
  jukeboxRole: boolean
  shareRole: boolean
  videoConversionRole: boolean
}

export interface Share {
  id: string
  url: string
  description?: string
  username: string
  created?: string
  expires?: string
  lastVisited?: string
  visitCount?: number
  item: { id: string; name: string; type: string }[]
}

export interface SearchResults {
  artist?: Artist[]
  album?: Album[]
  song?: Song[]
  playlist?: Playlist[]
}

/* --------------------------------------------------------------- updates */

/** Mirrors the main-process updater status into the renderer. */
export type UpdateState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'available'; version: string }
  | { kind: 'downloading'; percent: number }
  | { kind: 'downloaded'; version: string }
  | { kind: 'up-to-date' }
  | { kind: 'error'; message: string; manual: boolean }

/* ---------------------------------------------------------------------- misc */

export type MenuAction =
  | 'play-pause'
  | 'next'
  | 'previous'
  | 'seek-forward'
  | 'seek-backward'
  | 'volume-up'
  | 'volume-down'
  | 'show'
  | 'settings'
  | 'clear-queue'
  | 'shuffle-toggle'
  | 'repeat-toggle'

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  accent: DEFAULT_ACCENT,
  showCoverArtInSidebar: true,
  compactAlbumGrid: false,
  confirmOnQuit: false,
  startMinimized: false,
  autoUpdate: true,
  audio: {
    transcode: true,
    maxBitRate: 0,
    format: 'raw',
    gapless: true,
    crossfade: 0,
    volume: 0.8,
    muted: false,
    jukebox: false,
    scrobble: true,
    playbackReport: true
  }
}
