import { useCallback } from 'react'
import { useParams } from '@tanstack/react-router'
import { Play, Shuffle, Heart, Plus, Clock, Music2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  useAlbumQuery,
  useLibraryNavigation,
  usePlaySongs,
  useTrackAnnotations
} from '../shared/hooks'
import { Button, EmptyState, ErrorState, Skeleton, Badge, IconButton, Rating } from '../../components/ui/primitives'
import { TrackRow, TrackHeader } from '../../components/items/TrackRow'
import { requestAddToPlaylist } from '../../components/items/AddToPlaylistDialog'
import { CoverArt } from '../../components/items/CoverArt'
import { usePlayer } from '../../store/player'
import { formatCount, formatTotalDuration, groupByDisc } from '../../lib/utils'
import type { Song } from '@shared/types'

/** Stable empty array: `?? []` would hand `useCallback` a new identity every render. */
const EMPTY_SONGS: Song[] = []

export function AlbumPage() {
  const { albumId } = useParams({ from: '/album/$albumId' })
  const { artist } = useLibraryNavigation()
  const playSongs = usePlaySongs()
  const { onStar, onRate } = useTrackAnnotations()
  const addToQueue = usePlayer((s) => s.addToQueue)
  const playNext = usePlayer((s) => s.playNextInQueue)
  const toggleShuffle = usePlayer((s) => s.toggleShuffle)
  const shuffle = usePlayer((s) => s.shuffle)

  const { data: album, isLoading, error, refetch } = useAlbumQuery(albumId)

  /**
   * `TrackRow` is memoised, but `memo` compares props shallowly — an inline
   * arrow is a new function identity on every render, so an album with 60
   * tracks re-rendered every row whenever this page did anything. These are
   * stable so the memo can actually do its job.
   */
  const songs = album?.songList ?? EMPTY_SONGS
  const playFrom = useCallback((target: number) => playSongs(songs, target), [playSongs, songs])
  const playNextHere = useCallback((list: Song[]) => playNext(list), [playNext])
  const addHere = useCallback((list: Song[]) => addToQueue(list), [addToQueue])
  const addToPlaylistHere = useCallback(
    (list: Song[]) => requestAddToPlaylist(list.map((item) => item.id)),
    []
  )

  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />

  if (isLoading || !album) {
    return (
      <div className="space-y-6">
        <div className="flex gap-6">
          <Skeleton className="size-48 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-3 pt-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-11 w-full" />
        ))}
      </div>
    )
  }

  const discs = groupByDisc(songs)

  const play = () => {
    playSongs(songs, 0)
  }

  const playShuffled = () => {
    if (!shuffle) toggleShuffle()
    playSongs([...songs].sort(() => Math.random() - 0.5), 0)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6 sm:flex-row">
        <CoverArt
          id={album.coverArt}
          size={640}
          alt={album.name}
          rounded="rounded-xl"
          className="size-44 shrink-0 shadow-[var(--nav-shadow)] sm:size-52"
          eager
        />

        <div className="min-w-0 flex-1 space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-faint">
              Album
              {album.isCompilation && <Badge>Compilation</Badge>}
            </div>
            <h1 className="text-3xl font-semibold leading-tight tracking-tight text-fg">{album.name}</h1>
            {album.artist && (
              <button
                type="button"
                onClick={() => album.artistId && artist(album.artistId)}
                className="text-sm text-muted transition-colors hover:text-fg hover:underline"
              >
                {album.displayArtist ?? album.artist}
              </button>
            )}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-faint">
              {album.year && <span>{album.year}</span>}
              {album.genre && (
                <>
                  <span aria-hidden>·</span>
                  <span>{album.genre}</span>
                </>
              )}
              <span aria-hidden>·</span>
              <span>{formatCount(songs.length, 'track')}</span>
              {album.duration ? (
                <>
                  <span aria-hidden>·</span>
                  <span>{formatTotalDuration(album.duration)}</span>
                </>
              ) : null}
              {album.playCount ? (
                <>
                  <span aria-hidden>·</span>
                  <span>{formatCount(album.playCount, 'play')}</span>
                </>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" size="lg" onClick={play} disabled={songs.length === 0}>
              <Play className="size-4 fill-current" />
              Play
            </Button>
            <Button variant="secondary" size="lg" onClick={playShuffled} disabled={songs.length === 0}>
              <Shuffle className="size-4" />
              Shuffle
            </Button>
            <IconButton
              label={album.starred ? 'Remove album from favourites' : 'Add album to favourites'}
              size="icon"
              variant="secondary"
              onClick={() => songs[0] && onStar(songs[0])}
            >
              <Heart className={album.starred ? 'size-4 fill-current text-accent-strong' : 'size-4'} />
            </IconButton>
            <Button
              variant="ghost"
              onClick={() => {
                addToQueue(songs)
                toast.success(`Added ${songs.length} tracks to the queue`)
              }}
              disabled={songs.length === 0}
            >
              <Plus className="size-4" />
              Queue
            </Button>
            {album.averageRating ? (
              <span className="ml-1 text-xs text-faint">
                Server rating {album.averageRating.toFixed(1)}
              </span>
            ) : null}
          </div>

          {/* Album rating. Subsonic stores ratings per song, so an album's
              rating is the first track's — the same track the heart button
              above already stars. */}
          {songs[0] ? (
            <div className="flex items-center gap-2">
              <Rating
                value={songs[0].userRating ?? 0}
                onChange={(rating) => void onRate(songs[0], rating)}
              />
              <span className="text-xs text-faint">Your rating</span>
            </div>
          ) : null}
        </div>
      </div>

      {songs.length === 0 ? (
        <EmptyState icon={Music2} title="No tracks in this album" />
      ) : (
        <div className="space-y-6">
          {discs.map((disc, discIndex) => {
            // Rows are rendered per disc, but playback is driven from the whole
            // album, so each row needs its absolute position in `songs`.
            const offset = discs.slice(0, discIndex).reduce((total, item) => total + item.songs.length, 0)
            return (
              <section key={disc.discNumber} className="space-y-1">
                {discs.length > 1 && (
                  <div className="flex items-center gap-2 px-2 pt-2 text-[11px] font-semibold uppercase tracking-widest text-faint">
                    <Clock className="size-3" />
                    {disc.title}
                  </div>
                )}
                <TrackHeader showArt={false} />
                <div className="space-y-px">
                  {disc.songs.map((song, index) => (
                    <TrackRow
                      key={song.id}
                      song={song}
                      index={offset + index}
                      showArt={false}
                      onPlay={playFrom}
                      onGoToArtist={song.artistId ? () => artist(song.artistId!) : undefined}
                      onPlayNext={playNextHere}
                      onAddToQueue={addHere}
                      onAddToPlaylist={addToPlaylistHere}
                      onStar={(item) => void onStar(item)}
                      onRate={(item, rating) => void onRate(item, rating)}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
