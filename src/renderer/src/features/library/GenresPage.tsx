import { useNavigate, useParams } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Library, Play, Shuffle, Disc3 } from 'lucide-react'
import { getSongsByGenre } from '../../lib/api'
import { queryKeys, STALE } from '../../lib/query-keys'
import { useServerId } from '../../store/server'
import { useGenresQuery, usePlaySongs } from '../shared/hooks'
import { PageHeader } from '../shared/Page'
import { Button, EmptyState, ErrorState, Skeleton } from '../../components/ui/primitives'
import { CoverArt } from '../../components/items/CoverArt'
import { TrackRow, TrackHeader } from '../../components/items/TrackRow'
import { usePlayer } from '../../store/player'
import { formatCount } from '../../lib/utils'

export function GenresPage() {
  const navigate = useNavigate()
  const { data, isLoading, error, refetch } = useGenresQuery()

  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Genres" />
        <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-2">
          {Array.from({ length: 12 }, (_, index) => (
            <Skeleton key={index} className="h-24 rounded-app" />
          ))}
        </div>
      </div>
    )
  }

  const genres = data ?? []

  return (
    <div className="space-y-6">
      <PageHeader title="Genres" subtitle={genres.length ? `${genres.length} in your library` : undefined} />

      {genres.length === 0 ? (
        <EmptyState
          icon={Library}
          title="No genres found"
          description="Genres come from the tags Navidrome read while scanning your library."
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-2">
          {genres.map((genre) => (
            <button
              key={genre.value}
              type="button"
              onClick={() => navigate({ to: '/genre/$genre', params: { genre: genre.value } })}
              className="group flex h-24 flex-col justify-between rounded-app border border-line bg-surface p-3 text-left transition-colors hover:border-accent/40 hover:bg-surface-2"
            >
              <span className="truncate text-sm font-medium text-fg">{genre.value}</span>
              <span className="text-xs text-faint">
                {formatCount(genre.songCount, 'track')}
                {genre.albumCount ? ` · ${formatCount(genre.albumCount, 'album')}` : ''}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function GenrePage() {
  const { genre } = useParams({ from: '/genre/$genre' })
  const serverId = useServerId()
  const playSongs = usePlaySongs()
  const addToQueue = usePlayer((s) => s.addToQueue)
  const playNext = usePlayer((s) => s.playNextInQueue)
  const toggleShuffle = usePlayer((s) => s.toggleShuffle)
  const shuffle = usePlayer((s) => s.shuffle)

  const { data: songs, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.songsByGenre(serverId!, genre),
    queryFn: () => getSongsByGenre(genre, 500),
    enabled: Boolean(serverId && genre),
    staleTime: STALE.library
  })

  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />

  const list = songs ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          <CoverArt
            id={list[0]?.coverArt}
            size={192}
            alt=""
            className="size-20 shrink-0 rounded-xl"
          />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-fg">{genre}</h1>
            <p className="mt-0.5 text-sm text-muted">{formatCount(list.length, 'track')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="primary" onClick={() => playSongs(list, 0)} disabled={list.length === 0}>
            <Play className="size-4 fill-current" />
            Play
          </Button>
          <Button
            variant="secondary"
            disabled={list.length === 0}
            onClick={() => {
              if (!shuffle) toggleShuffle()
              playSongs([...list].sort(() => Math.random() - 0.5), 0)
            }}
          >
            <Shuffle className="size-4" />
            Shuffle
          </Button>
          <Button
            variant="ghost"
            disabled={list.length === 0}
            onClick={() => addToQueue(list)}
          >
            Queue
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-1">
          {Array.from({ length: 10 }, (_, index) => (
            <Skeleton key={index} className="h-11 w-full" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState icon={Disc3} title="No tracks in this genre" />
      ) : (
        <div className="space-y-1">
          <TrackHeader />
          {list.map((song, index) => (
            <TrackRow
              key={song.id}
              song={song}
              index={index}
              showAlbum
              album={{ name: song.album, coverArt: song.coverArt }}
              onPlay={(target) => playSongs(list, target)}
              onPlayNext={(items) => playNext(items)}
              onAddToQueue={(items) => addToQueue(items)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
