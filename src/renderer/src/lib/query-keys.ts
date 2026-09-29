import type { AlbumListType } from './api'
import { NO_SEARCH_OFFSETS, type SearchOffsets } from './api'

/**
 * Centralised TanStack Query keys.
 *
 * Two behaviours matter here:
 *  - the active server id is part of every key, so switching servers can never
 *    show the previous library's data from cache;
 *  - album lists are keyed by their parameters, so "Recently Added" and
 *    "Random" cache independently and survive navigation.
 */
export const queryKeys = {
  root: (serverId: string) => ['server', serverId] as const,

  genres: (serverId: string) => ['server', serverId, 'genres'] as const,
  artists: (serverId: string) => ['server', serverId, 'artists'] as const,
  artist: (serverId: string, id: string) => ['server', serverId, 'artist', id] as const,
  albumInfo: (serverId: string, id: string) => ['server', serverId, 'albumInfo', id] as const,

  albumList: (serverId: string, type: AlbumListType, extra?: Record<string, unknown>) =>
    ['server', serverId, 'albumList', type, extra ?? {}] as const,
  // `useAlbumListPages` stores react-query's infinite-query shape
  // (`{pages, pageParams}`), which must never share a cache slot with the
  // plain `Album[]` stored under `albumList` — reading one shape where the
  // other lives throws in whichever hook gets there second.
  albumListPages: (serverId: string, type: AlbumListType, extra?: Record<string, unknown>) =>
    ['server', serverId, 'albumListPages', type, extra ?? {}] as const,

  starred: (serverId: string) => ['server', serverId, 'starred'] as const,
  nowPlaying: (serverId: string) => ['server', serverId, 'nowPlaying'] as const,
  randomSongs: (serverId: string, genre?: string) => ['server', serverId, 'random', genre ?? null] as const,
  songsByGenre: (serverId: string, genre: string) => ['server', serverId, 'genre', genre] as const,

  album: (serverId: string, id: string) => ['server', serverId, 'album', id] as const,
  song: (serverId: string, id: string) => ['server', serverId, 'song', id] as const,

  search: (serverId: string, query: string, offsets: SearchOffsets = NO_SEARCH_OFFSETS) =>
    ['server', serverId, 'search', query, offsets] as const,

  playlists: (serverId: string) => ['server', serverId, 'playlists'] as const,
  playlist: (serverId: string, id: string) => ['server', serverId, 'playlist', id] as const,

  lyrics: (serverId: string, songId: string) => ['server', serverId, 'lyrics', songId] as const,
  radio: (serverId: string) => ['server', serverId, 'radio'] as const,
  scanStatus: (serverId: string) => ['server', serverId, 'scan'] as const,
  user: (serverId: string) => ['server', serverId, 'user'] as const
}

/** Cache lifetimes tuned to how quickly a music library actually changes. */
export const STALE = {
  /** Songs, albums and artists are stable between scans. */
  library: 5 * 60_000,
  /** Now-playing and search should feel instant. */
  live: 30_000,
  /** Lyrics never change for a given track id. */
  lyrics: 24 * 60 * 60_000
} as const
