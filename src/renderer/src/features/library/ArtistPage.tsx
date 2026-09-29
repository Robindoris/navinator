import { useParams } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Play, Shuffle, Disc3 } from 'lucide-react'
import { toast } from 'sonner'
import type { Song } from '@shared/types'
import { getAlbum, getArtist } from '../../lib/api'
import { queryKeys, STALE } from '../../lib/query-keys'
import { useServerId } from '../../store/server'
import { useLibraryNavigation, usePlaySongs } from '../shared/hooks'
import { AlbumGrid } from '../shared/Page'
import { Button, EmptyState, ErrorState, Skeleton, Badge } from '../../components/ui/primitives'
import { CoverArt } from '../../components/items/CoverArt'
import { usePlayer } from '../../store/player'
import { formatCount } from '../../lib/utils'

/**
 * Artist view.
 *
 * `getArtist` returns album stubs without track listings, so playing an artist
 * has to resolve album tracks first. The first album's tracks are fetched on
 * demand and cached, which makes repeat visits instant.
 */
export function ArtistPage() {
  const { artistId } = useParams({ from: '/artist/$artistId' })
  const serverId = useServerId()
  const queryClient = useQueryClient()
  const { album: openAlbum } = useLibraryNavigation()
  const playSongs = usePlaySongs()
  const addToQueue = usePlayer((s) => s.addToQueue)
  const toggleShuffle = usePlayer((s) => s.toggleShuffle)
  const shuffle = usePlayer((s) => s.shuffle)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.artist(serverId!, artistId),
    queryFn: () => getArtist(artistId),
    enabled: Boolean(serverId && artistId),
    staleTime: STALE.library
  })

  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />

  if (isLoading || !data) {
    return (
      <div className="space-y-8">
        <div className="flex gap-6">
          <Skeleton className="size-40 shrink-0 rounded-full" />
          <div className="flex-1 space-y-3 pt-6">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-1/2" />
          </div>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-1">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="aspect-square rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  const albums: { id: string; name: string; coverArt?: string; songCount?: number }[] = data.album ?? []

  /** Resolves the tracks for a set of album ids, using the cache where possible. */
  const collectSongs = async (ids: string[], limit = 20): Promise<Song[]> => {
    const songs: Song[] = []
    for (const id of ids.slice(0, limit)) {
      const key = queryKeys.album(serverId!, id)
      let full = queryClient.getQueryData<{ songList?: Song[] }>(key)
      if (!full?.songList?.length) {
        try {
          full = await getAlbum(id)
          queryClient.setQueryData(key, full)
        } catch {
          continue
        }
      }
      songs.push(...(full.songList ?? []))
    }
    return songs
  }

  const playArtist = async () => {
    const first = albums[0]
    if (!first) return
    const songs = await collectSongs([first.id], 1)
    if (songs.length > 0) playSongs(songs, 0)
  }

  const shuffleArtist = async () => {
    if (albums.length === 0) return
    if (!shuffle) toggleShuffle()
    const songs = await collectSongs(albums.map((item) => item.id), 10)
    if (songs.length === 0) {
      toast.error('Could not load tracks for this artist')
      return
    }
    playSongs([...songs].sort(() => Math.random() - 0.5), 0)
  }

  const queueAll = async () => {
    const songs = await collectSongs(albums.map((item) => item.id), 10)
    if (songs.length > 0) {
      addToQueue(songs)
      toast.success(`Queued ${songs.length} tracks`)
    }
  }

  const playAlbumTracks = async (albumId: string) => {
    const songs = await collectSongs([albumId], 1)
    if (songs.length > 0) playSongs(songs, 0)
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
        <CoverArt
          id={data.coverArt}
          size={400}
          alt={data.name}
          rounded="rounded-full"
          className="size-40 shrink-0 shadow-[var(--nav-shadow)]"
          eager
        />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="text-xs font-medium uppercase tracking-widest text-faint">Artist</div>
          <h1 className="text-3xl font-semibold tracking-tight text-fg">{data.name}</h1>
          <div className="text-xs text-faint">
            {formatCount(data.albumCount ?? albums.length, 'album')} in your library
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <Button variant="primary" onClick={() => void playArtist()} disabled={albums.length === 0}>
              <Play className="size-4 fill-current" />
              Play
            </Button>
            <Button variant="secondary" onClick={() => void shuffleArtist()} disabled={albums.length === 0}>
              <Shuffle className="size-4" />
              Shuffle
            </Button>
            <Button variant="ghost" onClick={() => void queueAll()} disabled={albums.length === 0}>
              Queue all
            </Button>
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-tight text-fg">
          Albums <Badge className="ml-1.5">{albums.length}</Badge>
        </h2>
        {albums.length === 0 ? (
          <EmptyState icon={Disc3} title="No albums for this artist" />
        ) : (
          <AlbumGrid
            albums={albums as never}
            onOpen={(item) => openAlbum(item.id)}
            onPlay={(item) => void playAlbumTracks(item.id)}
          />
        )}
      </section>
    </div>
  )
}
