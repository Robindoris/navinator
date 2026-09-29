import { useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Song, Album, Playlist } from '@shared/types'
import { useServerId } from '../../store/server'
import { usePlayer } from '../../store/player'
import { queryKeys, STALE } from '../../lib/query-keys'
import {
  getAlbum,
  getAlbumList,
  getArtist,
  getArtists,
  getGenres,
  getLyrics,
  getPlaylists,
  getPlaylist,
  getStarred,
  getUser,
  setRating,
  star,
  unstar
} from '../../lib/api'

/* ------------------------------------------------------------- navigation */

/**
 * Centralised navigation so rows, cards and menus all open the same screens
 * and stay consistent when routes change.
 */
export function useLibraryNavigation() {
  const navigate = useNavigate()
  return {
    album: useCallback((id: string) => navigate({ to: '/album/$albumId', params: { albumId: id } }), [navigate]),
    artist: useCallback((id: string) => navigate({ to: '/artist/$artistId', params: { artistId: id } }), [navigate]),
    playlist: useCallback(
      (id: string) => navigate({ to: '/playlist/$playlistId', params: { playlistId: id } }),
      [navigate]
    ),
    genre: useCallback((name: string) => navigate({ to: '/genre/$genre', params: { genre: name } }), [navigate])
  }
}

/* ---------------------------------------------------------------- queries */

export function useAlbumListQuery(type: Parameters<typeof getAlbumList>[0], extra?: Record<string, unknown>) {
  const serverId = useServerId()
  return useQuery({
    queryKey: queryKeys.albumList(serverId!, type, extra),
    queryFn: () => getAlbumList(type, 200, 0, extra),
    enabled: Boolean(serverId),
    staleTime: type === 'random' ? 0 : STALE.library
  })
}

export function useAlbumQuery(id: string) {
  const serverId = useServerId()
  return useQuery({
    queryKey: queryKeys.album(serverId!, id),
    queryFn: () => getAlbum(id),
    enabled: Boolean(serverId && id)
  })
}

export function useArtistsQuery() {
  const serverId = useServerId()
  return useQuery({
    queryKey: queryKeys.artists(serverId!),
    queryFn: getArtists,
    enabled: Boolean(serverId),
    staleTime: STALE.library
  })
}

export function useGenresQuery() {
  const serverId = useServerId()
  return useQuery({
    queryKey: queryKeys.genres(serverId!),
    queryFn: getGenres,
    enabled: Boolean(serverId),
    staleTime: STALE.library
  })
}

export function usePlaylistsQuery() {
  const serverId = useServerId()
  return useQuery({
    queryKey: queryKeys.playlists(serverId!),
    queryFn: getPlaylists,
    enabled: Boolean(serverId),
    staleTime: STALE.library
  })
}

export function usePlaylistQuery(id: string) {
  const serverId = useServerId()
  return useQuery({
    queryKey: queryKeys.playlist(serverId!, id),
    queryFn: () => getPlaylist(id),
    enabled: Boolean(serverId && id)
  })
}

export function useStarredQuery() {
  const serverId = useServerId()
  return useQuery({
    queryKey: queryKeys.starred(serverId!),
    queryFn: getStarred,
    enabled: Boolean(serverId),
    staleTime: STALE.library
  })
}

export function useUserQuery() {
  const serverId = useServerId()
  return useQuery({
    queryKey: queryKeys.user(serverId!),
    queryFn: () => getUser(),
    enabled: Boolean(serverId),
    staleTime: STALE.library
  })
}

/** Lyrics are immutable for a given track id, so they are cached for a day. */
export function useLyricsQuery(songId: string | undefined) {
  const serverId = useServerId()
  return useQuery({
    queryKey: queryKeys.lyrics(serverId!, songId!),
    queryFn: () => getLyrics(songId!),
    enabled: Boolean(serverId && songId),
    staleTime: STALE.lyrics,
    gcTime: STALE.lyrics,
    retry: false
  })
}

/* --------------------------------------------------------------- mutations */

/**
 * Optimistically toggles the "favourite" flag across every cached view, so the
 * heart fills in immediately on the list, grid and detail screens at once.
 */
export function useToggleStar() {
  const queryClient = useQueryClient()
  const serverId = useServerId()

  return useCallback(
    async (song: Song) => {
      const starred = song.starred !== undefined
      const albumId = song.albumId
      const artistId = song.artistId

      queryClient.setQueriesData({ queryKey: ['server', serverId] }, (old: unknown) => {
        if (!old || typeof old !== 'object') return old
        return toggleStarInTree(old, song.id, starred, albumId, artistId)
      })

      try {
        if (starred) await unstar(song.id, albumId, artistId)
        else await star(song.id, albumId, artistId)
      } catch (error) {
        // Roll back by refetching; simpler and safer than patching again.
        await queryClient.invalidateQueries({ queryKey: ['server', serverId] })
        throw error
      }
    },
    [queryClient, serverId]
  )
}

function toggleStarInTree(
  node: unknown,
  songId: string,
  wasStarred: boolean,
  albumId?: string,
  artistId?: string
): unknown {
  if (Array.isArray(node)) {
    return node.map((item) => toggleStarInTree(item, songId, wasStarred, albumId, artistId))
  }
  if (typeof node !== 'object' || node === null) return node

  const record = node as Record<string, unknown>
  const next: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(record)) {
    if (value === songId && (key === 'id' || key === 'current') && wasStarred) continue
    if (Array.isArray(value) && wasStarred) {
      // Drop the item from starred collections.
      const filtered = value.filter((item) => !(typeof item === 'object' && item && (item as { id?: string }).id === songId))
      if (filtered.length !== value.length) continue
    }
    next[key] = typeof value === 'object' && value !== null
      ? toggleStarInTree(value, songId, wasStarred, albumId, artistId)
      : value
  }

  const self = record as { id?: string; starred?: string; albumId?: string; artistId?: string }
  if (self.id === songId) next['starred'] = wasStarred ? undefined : new Date().toISOString()
  if (self.id === albumId && wasStarred) next['starred'] = new Date().toISOString()
  if (self.id === artistId && wasStarred) next['starred'] = new Date().toISOString()

  return next
}

export function useSetRating() {
  const queryClient = useQueryClient()
  const serverId = useServerId()
  return useCallback(
    async (song: Song, rating: number) => {
      await setRating(song.id, rating)
      await queryClient.invalidateQueries({ queryKey: ['server', serverId] })
    },
    [queryClient, serverId]
  )
}

/* --------------------------------------------------------------- playback */

/** How many albums to resolve when playing a whole artist. */
const MAX_ARTIST_ALBUMS = 25

/** Shared "play this list of songs" entry point used by every view. */
export function usePlaySongs() {
  const playQueue = usePlayer((s) => s.playQueue)
  return useCallback((songs: Song[], startIndex = 0) => playQueue(songs, startIndex), [playQueue])
}

/**
 * Plays an album by id.
 *
 * Grid cards only carry album metadata, so the tracks have to be fetched before
 * playback can start. Previously-played albums are served from the query cache,
 * which makes this instant on the second visit.
 */
export function usePlayAlbum() {
  const queryClient = useQueryClient()
  const serverId = useServerId()
  const playQueue = usePlayer((s) => s.playQueue)

  return useCallback(
    async (albumId: string, album?: Album) => {
      let songs: Song[] = []

      const cached = queryClient.getQueryData<Album>(queryKeys.album(serverId!, albumId))
      if (cached?.songList?.length) {
        songs = cached.songList
      } else {
        const fetched = await getAlbum(albumId)
        songs = fetched.songList ?? []
        queryClient.setQueryData(queryKeys.album(serverId!, albumId), fetched)
      }

      if (songs.length === 0) return
      // `songList` entries need the album id for cross-links (artist, parent).
      const enriched = songs.map((song) => ({ ...song, albumId: song.albumId ?? albumId, album: song.album ?? album?.name }))
      playQueue(enriched, 0)
    },
    [playQueue, queryClient, serverId]
  )
}

/**
 * Plays a playlist by id.
 *
 * Playlist cards only carry metadata, so the tracks are resolved on demand and
 * cached, which makes a second visit instant. Errors are surfaced by the caller
 * because only it knows whether a toast is appropriate.
 */
export function usePlayPlaylist() {
  const queryClient = useQueryClient()
  const serverId = useServerId()
  const playQueue = usePlayer((s) => s.playQueue)

  return useCallback(
    async (playlistId: string) => {
      const key = queryKeys.playlist(serverId!, playlistId)
      let detail = queryClient.getQueryData<{ entry?: Song[] }>(key)
      if (!detail?.entry?.length) {
        detail = await getPlaylist(playlistId)
        queryClient.setQueryData(key, detail)
      }
      if (!detail.entry?.length) return false
      playQueue(detail.entry, 0)
      return true
    },
    [playQueue, queryClient, serverId]
  )
}

/**
 * Plays everything by an artist.
 *
 * An artist record only lists album ids, so every album has to be fetched
 * before a queue can be built. Fetching a discography in full is far too slow on
 * a large library, so the albums are taken newest-first and capped — enough for
 * a long session without a burst of requests.
 */
export function usePlayArtist() {
  const queryClient = useQueryClient()
  const serverId = useServerId()
  const playQueue = usePlayer((s) => s.playQueue)

  return useCallback(
    async (artistId: string) => {
      const artist = await getArtist(artistId)
      const albums = artist?.album ?? []
      if (albums.length === 0) return false

      const picked = albums.slice(0, MAX_ARTIST_ALBUMS)
      const details = await Promise.all(
        picked.map(async (album: { id: string }) => {
          const cached = queryClient.getQueryData<Album>(queryKeys.album(serverId!, album.id))
          if (cached) return cached
          try {
            const fetched = await getAlbum(album.id)
            queryClient.setQueryData(queryKeys.album(serverId!, album.id), fetched)
            return fetched
          } catch {
            return undefined
          }
        })
      )

      const songs = details.flatMap((item) => item?.songList ?? [])
      if (songs.length === 0) return false
      playQueue(songs, 0)
      return true
    },
    [playQueue, queryClient, serverId]
  )
}

/** Shuffles the whole recently-added pool into a playable queue. */
export function useShuffleLibrary(albumIds: string[]) {
  const queryClient = useQueryClient()
  const serverId = useServerId()
  const playQueue = usePlayer((s) => s.playQueue)

  return useCallback(async () => {
    if (albumIds.length === 0) return
    // Fetching every album would be slow on a large library, so a random slice
    // is used — enough for a long session without hammering the server.
    const picks = [...albumIds].sort(() => Math.random() - 0.5).slice(0, 15)
    const albums = await Promise.all(
      picks.map(async (id) => {
        const cached = queryClient.getQueryData<Album>(queryKeys.album(serverId!, id))
        if (cached) return cached
        try {
          return await getAlbum(id)
        } catch {
          return undefined
        }
      })
    )
    const songs = albums.flatMap((item) => item?.songList ?? [])
    if (songs.length > 0) playQueue([...songs].sort(() => Math.random() - 0.5), 0)
  }, [albumIds, playQueue, queryClient, serverId])
}

export type { Album, Playlist, Song }
