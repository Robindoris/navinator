/**
 * Allow-list of Subsonic / OpenSubsonic endpoints the renderer is permitted to
 * invoke.
 *
 * The renderer talks to the server indirectly: every call is forwarded to the
 * main process over a single generic `api:request` channel. Because the method
 * name arrives as an untrusted string it has to be validated against this list,
 * otherwise a compromised renderer could reach arbitrary members of the API
 * client. Members such as `custom` (arbitrary endpoint), `baseURL` and
 * `navidromeSession` are deliberately excluded — the main process uses those
 * itself.
 */

export const API_METHODS = [
  // System
  'ping',
  'getLicense',
  'getOpenSubsonicExtensions',

  // Browsing
  'getMusicFolders',
  'getIndexes',
  'getMusicDirectory',
  'getSong',
  'getArtists',
  'getArtist',
  'getAlbum',
  'getGenres',
  'getArtistInfo',
  'getArtistInfo2',
  'getAlbumInfo',
  'getAlbumInfo2',
  'getTopSongs',
  'getSimilarSongs',
  'getSimilarSongs2',

  // Album / song lists
  'getAlbumList',
  'getAlbumList2',
  'getStarred',
  'getStarred2',
  'getNowPlaying',
  'getRandomSongs',
  'getSongsByGenre',

  // Searching
  'search2',
  'search3',

  // Playlists
  'getPlaylists',
  'getPlaylist',
  'createPlaylist',
  'updatePlaylist',
  'deletePlaylist',
  'changePlaylistOrder',

  // Media retrieval
  'stream',
  'download',
  'getCoverArt',
  'getLyrics',
  // OpenSubsonic structured lyrics. `search3` does not embed lyrics, so this
  // has to be fetched per track.
  'getLyricsBySongId',
  'getAvatar',

  // Annotation
  'star',
  'unstar',
  'setRating',
  'scrobble',
  // OpenSubsonic `playbackReport`: richer than scrobble, needs `mediaId`.
  'reportPlayback',

  // Bookmarks
  'getBookmarks',
  'createBookmark',
  'deleteBookmark',

  // Play queue
  'getPlayQueue',
  'savePlayQueue',
  // OpenSubsonic `indexBasedQueue`
  'getPlayQueueByIndex',
  'savePlayQueueByIndex',

  // Sharing
  'getShares',
  'createShare',
  'updateShare',
  'deleteShare',

  // Internet radio
  'getInternetRadioStations',
  'createInternetRadioStation',
  'updateInternetRadioStation',
  'deleteInternetRadioStation',

  // Users
  'getUser',
  'getUsers',

  // Scanning
  'getScanStatus',
  'startScan'
] as const

export type ApiMethod = (typeof API_METHODS)[number]

const methodSet = new Set<string>(API_METHODS)

/** Type guard used by the IPC handler in the main process. */
export function isApiMethod(value: unknown): value is ApiMethod {
  return typeof value === 'string' && methodSet.has(value)
}

/** Methods that mutate server state, used to order scrobble/write flushing. */
export const MUTATING_METHODS: ReadonlySet<string> = new Set([
  'createPlaylist',
  'updatePlaylist',
  'deletePlaylist',
  'changePlaylistOrder',
  'star',
  'unstar',
  'setRating',
  'scrobble',
  'createBookmark',
  'deleteBookmark',
  'savePlayQueue',
  'createShare',
  'updateShare',
  'deleteShare',
  'createInternetRadioStation',
  'updateInternetRadioStation',
  'deleteInternetRadioStation',
  'startScan'
])
