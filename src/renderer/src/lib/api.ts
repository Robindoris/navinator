import { call } from './bridge'
import type { Song, Album, Playlist, Genre, SearchResults, ScanStatus, User } from '@shared/types'

/**
 * Typed wrappers around the Subsonic endpoints.
 *
 * `subsonic-api` already returns the contents of the `subsonic-response`
 * envelope, and dates on known fields are revived to `Date` objects — so
 * these helpers only need to unwrap the remaining one level of nesting that
 * the API uses for single-item results (`{ album: {...} }`).
 */

export interface SubsonicEnvelope {
  status: 'ok' | 'failed'
  version?: string
  type?: string
  serverVersion?: string
  openSubsonic?: boolean
  error?: { code: number; message?: string }
}

/* ------------------------------------------------------------------ system */

export const ping = () => call<SubsonicEnvelope & Record<string, never>>('ping')

export const getUser = (username?: string) =>
  call<{ user: User }>('getUser', username ? [{ username }] : undefined).then((r) => r.user)

export const getScanStatus = () =>
  call<{ scanStatus: ScanStatus }>('getScanStatus').then((r) => r.scanStatus)

export const startScan = (fullScan = false) => call('startScan', [{ fullScan }])

/* ---------------------------------------------------------------- browsing */

export const getGenres = () =>
  call<{ genres: { genre: Genre[] } }>('getGenres').then((r) => r.genres?.genre ?? [])

export const getMusicFolders = () =>
  call<{ musicFolders: { musicFolder: { id: number; name: string }[] } }>('getMusicFolders').then(
    (r) => r.musicFolders?.musicFolder ?? []
  )

export const getArtists = () =>
  call<{ artists: { index: { name: string; artist: any[] }[] } }>('getArtists').then((r) => [
    ...(r.artists?.index ?? [])
  ])

export const getArtist = (id: string) =>
  call<{ artist: any }>('getArtist', [{ id }]).then((r) => r.artist)

/* ------------------------------------------------------------- album lists */

export type AlbumListType =
  | 'random'
  | 'newest'
  | 'alphabeticalByName'
  | 'alphabeticalByArtist'
  | 'starred'
  | 'byYear'
  | 'frequent'
  | 'recent'
  | 'highest'
  | 'lowest'

export const getAlbumList = (type: AlbumListType, size = 100, offset = 0, extra: Record<string, unknown> = {}) =>
  call<{ albumList2: { album: Album[] } }>('getAlbumList2', [
    { type, size, offset, ...extra }
  ]).then((r) => r.albumList2?.album ?? [])

export const getStarred = () =>
  call<{ starred2: { album: Album[]; song: Song[]; artist: any[] } }>('getStarred2').then((r) => ({
    albums: r.starred2?.album ?? [],
    songs: r.starred2?.song ?? [],
    artists: r.starred2?.artist ?? []
  }))

export const getRandomSongs = (size = 50, genre?: string) =>
  call<{ randomSongs: { song: Song[] } }>('getRandomSongs', [genre ? { size, genre } : { size }]).then(
    (r) => r.randomSongs?.song ?? []
  )

export const getNowPlaying = () =>
  call<{ nowPlaying: { entry: (Song & { username: string; minutesAgo: number })[] } }>('getNowPlaying').then(
    (r) => r.nowPlaying?.entry ?? []
  )

export const getSongsByGenre = (genre: string, size = 200, offset = 0) =>
  call<{ songsByGenre: { song: Song[] } }>('getSongsByGenre', [{ genre, size, offset }]).then(
    (r) => r.songsByGenre?.song ?? []
  )

/* -------------------------------------------------------------- album view */

export const getAlbum = (id: string) =>
  call<{ album: Album & { song?: Song[] } }>('getAlbum', [{ id }]).then((r) => ({
    ...r.album,
    songList: r.album.songList ?? r.album.song ?? []
  }))

export const getAlbumInfo = (id: string) =>
  call<{ albumInfo: { notes?: string; musicBrainzId?: string; lastFmUrl?: string; smallImageUrl?: string } }>(
    'getAlbumInfo2',
    [{ id }]
  ).then((r) => r.albumInfo)

export const getSong = (id: string) => call<{ song: Song }>('getSong', [{ id }]).then((r) => r.song)

/* -------------------------------------------------------------- searching */

/**
 * Page sizes for each `search3` result type.
 *
 * The first page is deliberately modest — search is a filtering UI, not a
 * browser, and a 3,000-row response for a two-character query is hostile to
 * both the server and the renderer. Paging on demand goes from there.
 */
export const SEARCH_PAGE = { artist: 20, album: 20, song: 40, playlist: 10 } as const

export interface SearchOffsets {
  artist: number
  album: number
  song: number
  playlist: number
}

export const NO_SEARCH_OFFSETS: SearchOffsets = { artist: 0, album: 0, song: 0, playlist: 0 }

/**
 * Searches the library.
 *
 * `search3` counts *and* offsets are per result type, so every section is
 * paged independently. A short section is the end-of-list signal.
 */
export const search = (
  query: string,
  counts: { artist: number; album: number; song: number; playlist: number } = { ...SEARCH_PAGE },
  offsets: SearchOffsets = NO_SEARCH_OFFSETS
): Promise<SearchResults> =>
  call<{ searchResult3: SearchResults }>('search3', [
    {
      query,
      artistCount: counts.artist,
      albumCount: counts.album,
      songCount: counts.song,
      playlistCount: counts.playlist,
      artistOffset: offsets.artist,
      albumOffset: offsets.album,
      songOffset: offsets.song,
      playlistOffset: offsets.playlist
    }
  ]).then((r) => r.searchResult3 ?? {})

/* -------------------------------------------------------------- playlists */

export const getPlaylists = () =>
  call<{ playlists: { playlist: Playlist[] } }>('getPlaylists').then((r) => r.playlists?.playlist ?? [])

export const getPlaylist = (id: string) =>
  call<{ playlist: Playlist & { entry: Song[] } }>('getPlaylist', [{ id }]).then((r) => r.playlist)

export const createPlaylist = (input: { name: string; comment?: string; public?: boolean; songIds?: string[] }) =>
  call<{ playlist: Playlist }>('createPlaylist', [input]).then((r) => r.playlist)

export const updatePlaylist = (input: {
  playlistId: string
  name?: string
  comment?: string
  public?: boolean
  songIdsToAdd?: string[]
  songIndexesToRemove?: number[]
}) => call<{ playlist: Playlist }>('updatePlaylist', [input]).then((r) => r.playlist)

export const deletePlaylist = (id: string) => call('deletePlaylist', [{ id }])

/**
 * Reorders a playlist.
 *
 * Subsonic takes the *whole* new id order, not a move instruction, and every
 * call is a full rewrite of the playlist — so the client sends the complete
 * list it already has in memory rather than trying to describe the delta.
 */
export const changePlaylistOrder = (playlistId: string, songIds: string[]) =>
  call<{ playlist: Playlist }>('changePlaylistOrder', [{ playlistId, songIds }]).then((r) => r.playlist)

/* ------------------------------------------------------------- annotation */

export const star = (id: string, albumId?: string, artistId?: string) =>
  call('star', [{ id, albumId, artistId }])

export const unstar = (id: string, albumId?: string, artistId?: string) =>
  call('unstar', [{ id, albumId, artistId }])

export const setRating = (id: string, rating: number) => call('setRating', [{ id, rating }])

export const scrobble = (id: string, submission: boolean) => call('scrobble', [{ id, submission }])

/**
 * OpenSubsonic `playbackReport`. Note the parameter is `mediaId`, not `id` —
 * getting this wrong is the difference between accurate listening stats and
 * none at all.
 */
export const reportPlayback = (input: {
  mediaId: string
  state: 'starting' | 'playing' | 'paused' | 'stopped'
  positionMs: number
  playbackRate?: number
}) => call('reportPlayback', [input])

/* ----------------------------------------------------------------- lyrics */

export interface StructuredWord {
  /** Milliseconds from the start of the track. */
  start?: number
  value: string
}

export interface StructuredLine {
  /** Milliseconds from the start of the track. */
  start?: number
  value: string
  /**
   * Word-level timings. Only present when the `songLyrics` extension answered
   * an `enhanced` request; plain servers send `line` alone.
   */
  word?: StructuredWord[]
}

export interface StructuredLyric {
  displayArtist?: string
  displayTitle?: string
  lang?: string
  offset?: number
  synced?: boolean
  line?: StructuredLine[]
}

/**
 * Structured lyrics.
 *
 * `search3` does not embed lyrics on the song objects, so they have to be
 * fetched per track. `enhanced` is the `songLyrics` v2 flag which adds
 * word-level timings for karaoke-style highlighting.
 */
export const getLyrics = async (id: string, enhanced = true): Promise<StructuredLyric[]> => {
  const result = await call<{ lyricsList?: { structuredLyrics?: StructuredLyric[] } }>(
    'getLyricsBySongId',
    [{ id, enhanced }]
  )
  return result.lyricsList?.structuredLyrics ?? []
}

/* ---------------------------------------------------------- queue & radio */

export const getPlayQueue = () =>
  call<{ playQueue?: { entry?: Song[]; current?: string; position?: number } }>('getPlayQueue').then(
    (r) => r.playQueue
  )

export const savePlayQueue = (ids: string[], current?: string, position?: number) =>
  call('savePlayQueue', [{ id: ids, current, position }])

export const getRadioStations = () =>
  call<{ internetRadioStations: { internetRadioStation: any[] } }>('getInternetRadioStations').then(
    (r) => r.internetRadioStations?.internetRadioStation ?? []
  )
