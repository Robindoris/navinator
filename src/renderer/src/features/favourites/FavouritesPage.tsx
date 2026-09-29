import { Heart, Play, Shuffle } from 'lucide-react'
import { toast } from 'sonner'
import {
  useLibraryNavigation,
  usePlayArtist,
  usePlaySongs,
  useStarredQuery,
  useTrackAnnotations
} from '../shared/hooks'
import { PageHeader, Section, AlbumGrid } from '../shared/Page'
import { Button, EmptyState, ErrorState, Skeleton } from '../../components/ui/primitives'
import { ArtistCard } from '../../components/items/Cards'
import { TrackRow, TrackHeader } from '../../components/items/TrackRow'
import { requestAddToPlaylist } from '../../components/items/AddToPlaylistDialog'
import { usePlayer } from '../../store/player'
import { formatCount } from '../../lib/utils'

export function FavouritesPage() {
  const { data, isLoading, error, refetch } = useStarredQuery()
  const { album, artist } = useLibraryNavigation()
  const playSongs = usePlaySongs()
  const playArtist = usePlayArtist()
  const addToQueue = usePlayer((s) => s.addToQueue)
  const playNext = usePlayer((s) => s.playNextInQueue)
  const { onStar, onRate } = useTrackAnnotations()
  const toggleShuffle = usePlayer((s) => s.toggleShuffle)
  const shuffle = usePlayer((s) => s.shuffle)

  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Favourites" />
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-11 w-full" />
        ))}
      </div>
    )
  }

  const albums = data?.albums ?? []
  const songs = data?.songs ?? []
  const artists = data?.artists ?? []

  if (albums.length === 0 && songs.length === 0 && artists.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Favourites" />
        <EmptyState
          icon={Heart}
          title="Nothing starred yet"
          description="Use the heart on any album, artist or song and it will appear here."
        />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Favourites"
        subtitle={[
          formatCount(albums.length, 'album'),
          formatCount(songs.length, 'song'),
          formatCount(artists.length, 'artist')
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={
          songs.length > 0 && (
            <>
              <Button variant="ghost" onClick={() => playSongs(songs, 0)}>
                <Play className="size-4 fill-current" />
                Play songs
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  if (!shuffle) toggleShuffle()
                  playSongs([...songs].sort(() => Math.random() - 0.5), 0)
                }}
              >
                <Shuffle className="size-4" />
                Shuffle
              </Button>
            </>
          )
        }
      />

      {artists.length > 0 && (
        <Section title={`Artists (${artists.length})`}>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-1">
            {artists.map((item) => (
              <ArtistCard
                key={item.id}
                artist={item}
                onOpen={(value) => artist(value.id)}
                onPlay={(value) => void playArtist(value.id).catch((err: Error) => toast.error(err.message))}
              />
            ))}
          </div>
        </Section>
      )}

      {albums.length > 0 && (
        <Section title={`Albums (${albums.length})`}>
          <AlbumGrid
            albums={albums}
            onOpen={(item) => album(item.id)}
            onPlay={() => songs.length > 0 && playSongs(songs, 0)}
          />
        </Section>
      )}

      {songs.length > 0 && (
        <Section
          title={`Songs (${songs.length})`}
          action={
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                addToQueue(songs)
              }}
            >
              Queue all
            </Button>
          }
        >
          <div className="space-y-1">
            <TrackHeader />
            {songs.map((song, index) => (
              <TrackRow
                key={song.id}
                song={song}
                index={index}
                showAlbum
                album={{ name: song.album, coverArt: song.coverArt }}
                onPlay={(target) => playSongs(songs, target)}
                onGoToAlbum={() => song.albumId && album(song.albumId)}
                onGoToArtist={() => song.artistId && artist(song.artistId)}
                onPlayNext={(items) => playNext(items)}
                onAddToQueue={(items) => addToQueue(items)} onAddToPlaylist={(items) => requestAddToPlaylist(items.map((item) => item.id))}
                onStar={onStar}
                onRate={onRate}
              />
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}
