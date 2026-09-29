import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search as SearchIcon, Music2, Play, Shuffle, X } from 'lucide-react'
import { toast } from 'sonner'
import { search } from '../../lib/api'
import { queryKeys, STALE } from '../../lib/query-keys'
import { useServerId } from '../../store/server'
import { useLibraryNavigation, usePlayAlbum, usePlayArtist, usePlayPlaylist, usePlaySongs } from '../shared/hooks'
import { AlbumGrid, PageHeader, Section } from '../shared/Page'
import { EmptyState, Skeleton, IconButton } from '../../components/ui/primitives'
import { ArtistCard, PlaylistCard } from '../../components/items/Cards'
import { TrackRow, TrackHeader } from '../../components/items/TrackRow'
import { usePlayer } from '../../store/player'

/** Debounces keystrokes so typing does not fire a request per character. */
function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export function SearchPage() {
  const [term, setTerm] = useState('')
  const debounced = useDebounced(term)
  const inputRef = useRef<HTMLInputElement>(null)
  const serverId = useServerId()
  const { album, artist, playlist } = useLibraryNavigation()
  const playSongs = usePlaySongs()
  const playAlbum = usePlayAlbum()
  const playArtist = usePlayArtist()
  const playPlaylist = usePlayPlaylist()
  const addToQueue = usePlayer((s) => s.addToQueue)
  const playNext = usePlayer((s) => s.playNextInQueue)
  const toggleShuffle = usePlayer((s) => s.toggleShuffle)
  const shuffle = usePlayer((s) => s.shuffle)

  // `navinator:focus-search` is dispatched by the `/` shortcut.
  useEffect(() => {
    const focus = () => inputRef.current?.focus()
    window.addEventListener('navinator:focus-search', focus)
    return () => window.removeEventListener('navinator:focus-search', focus)
  }, [])

  const query = useQuery({
    queryKey: queryKeys.search(serverId!, debounced),
    queryFn: () => search(debounced),
    enabled: Boolean(serverId && debounced.trim().length >= 2),
    staleTime: STALE.library
  })

  const results = useMemo(() => {
    const data = query.data
    if (!data) return { artists: [], albums: [], songs: [], playlists: [] }
    return {
      artists: data.artist ?? [],
      albums: data.album ?? [],
      songs: data.song ?? [],
      playlists: data.playlist ?? []
    }
  }, [query.data])

  const total = results.artists.length + results.albums.length + results.songs.length + results.playlists.length

  return (
    <div className="space-y-8">
      <PageHeader title="Search" subtitle={debounced.length >= 2 ? undefined : 'Search your whole library'} />

      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-faint" />
        <input
          ref={inputRef}
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setTerm('')
              event.currentTarget.blur()
            }
          }}
          placeholder="Artists, albums, songs and playlists…"
          aria-label="Search your library"
          autoFocus
          className="h-12 w-full rounded-app border border-line bg-surface-2 pl-11 pr-10 text-sm text-fg placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        {term && (
          <IconButton
            label="Clear search"
            size="icon-xs"
            variant="ghost"
            className="absolute right-3 top-1/2 -translate-y-1/2"
            onClick={() => {
              setTerm('')
              inputRef.current?.focus()
            }}
          >
            <X className="size-3.5" />
          </IconButton>
        )}
      </div>

      {debounced.trim().length < 2 ? (
        <EmptyState
          icon={SearchIcon}
          title="Start typing to search"
          description="Navidrome matches artists, albums, songs and playlists. Press / anywhere to jump back here."
        />
      ) : query.isFetching ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-11 w-full" />
          ))}
        </div>
      ) : total === 0 ? (
        <EmptyState
          icon={Music2}
          title={`No results for “${debounced}”`}
          description="Try fewer words, or a different spelling."
        />
      ) : (
        <div className="space-y-9">
          {results.artists.length > 0 && (
            <Section title={`Artists (${results.artists.length})`}>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-1">
                {results.artists.slice(0, 12).map((item) => (
                  <ArtistCard
                    key={item.id}
                    artist={item}
                    onOpen={(value) => artist(value.id)}
                    onPlay={(value) =>
                      void playArtist(value.id).catch((err: Error) => toast.error(err.message))
                    }
                  />
                ))}
              </div>
            </Section>
          )}

          {results.albums.length > 0 && (
            <Section
              title={`Albums (${results.albums.length})`}
              action={
                <button
                  type="button"
                  onClick={() => results.songs.length > 0 && playSongs(results.songs, 0)}
                  disabled={results.songs.length === 0}
                  className="inline-flex items-center gap-1 text-xs text-accent hover:underline disabled:opacity-40"
                >
                  <Play className="size-3 fill-current" />
                  Play matching songs
                </button>
              }
            >
              <AlbumGrid
                albums={results.albums}
                onOpen={(item) => album(item.id)}
                onPlay={(item) => void playAlbum(item.id, item)}
              />
            </Section>
          )}

          {results.songs.length > 0 && (
            <Section
              title={`Songs (${results.songs.length})`}
              action={
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => playSongs(results.songs, 0)}
                    className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                  >
                    <Play className="size-3 fill-current" />
                    Play
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!shuffle) toggleShuffle()
                      playSongs([...results.songs].sort(() => Math.random() - 0.5), 0)
                    }}
                    className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                  >
                    <Shuffle className="size-3" />
                    Shuffle
                  </button>
                </div>
              }
            >
              <div className="space-y-1">
                <TrackHeader />
                {results.songs.map((song, index) => (
                  <TrackRow
                    key={song.id}
                    song={song}
                    index={index}
                    showAlbum
                    album={{ name: song.album, coverArt: song.coverArt }}
                    onPlay={(target) => playSongs(results.songs, target)}
                    onGoToAlbum={() => song.albumId && album(song.albumId)}
                    onGoToArtist={() => song.artistId && artist(song.artistId)}
                    onPlayNext={(items) => playNext(items)}
                    onAddToQueue={(items) => addToQueue(items)}
                  />
                ))}
              </div>
            </Section>
          )}

          {results.playlists.length > 0 && (
            <Section title={`Playlists (${results.playlists.length})`}>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-1">
                {results.playlists.map((item) => (
                  <PlaylistCard
                    key={item.id}
                    playlist={item}
                    onOpen={(value) => playlist(value.id)}
                    onPlay={(value) => void playPlaylist(value.id).catch((error: Error) => toast.error(error.message))}
                  />
                ))}
              </div>
            </Section>
          )}
        </div>
      )}
    </div>
  )
}
