import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search as SearchIcon, Music2, Play, Shuffle, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  NO_SEARCH_OFFSETS,
  SEARCH_PAGE,
  search,
  type SearchOffsets
} from '../../lib/api'
import { queryKeys, STALE } from '../../lib/query-keys'
import { useServerId } from '../../store/server'
import {
  useLibraryNavigation,
  usePlayAlbum,
  usePlayArtist,
  usePlayPlaylist,
  usePlaySongs,
  useTrackAnnotations
} from '../shared/hooks'
import { AlbumGrid, PageHeader, Section } from '../shared/Page'
import { EmptyState, Skeleton, IconButton, Button } from '../../components/ui/primitives'
import { ArtistCard, PlaylistCard } from '../../components/items/Cards'
import { TrackRow, TrackHeader } from '../../components/items/TrackRow'
import { requestAddToPlaylist } from '../../components/items/AddToPlaylistDialog'
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
  const { onStar, onRate } = useTrackAnnotations()
  const toggleShuffle = usePlayer((s) => s.toggleShuffle)
  const shuffle = usePlayer((s) => s.shuffle)

  // `navinator:focus-search` is dispatched by the `/` shortcut.
  useEffect(() => {
    const focus = () => inputRef.current?.focus()
    window.addEventListener('navinator:focus-search', focus)
    return () => window.removeEventListener('navinator:focus-search', focus)
  }, [])

  /**
   * Search is paged per section: one `search3` call covers all four types, so
   * "more songs" and "more artists" cannot be requested independently without
   * losing the others. The offsets are tracked per type and the first page is
   * the only one loaded automatically; the rest arrive when asked for.
   */
  const [offsets, setOffsets] = useState<SearchOffsets>(NO_SEARCH_OFFSETS)
  const enabled = Boolean(serverId && debounced.trim().length >= 2)

  // A new term must start from a clean slate, or stale offsets would skip
  // straight past the top of the new result set. Resetting happens during
  // render, not in an effect, to avoid a cascading render.
  const [prevDebounced, setPrevDebounced] = useState(debounced)
  if (prevDebounced !== debounced) {
    setPrevDebounced(debounced)
    setOffsets(NO_SEARCH_OFFSETS)
  }

  const query = useQuery({
    queryKey: queryKeys.search(serverId!, debounced, offsets),
    queryFn: () => search(debounced, { ...SEARCH_PAGE }, offsets),
    enabled,
    staleTime: STALE.library,
    // Every offset change is a new query, so results should swap rather than
    // leave the previous page's rows on screen.
    placeholderData: (previous) => previous
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

  /**
   * A section is exhausted when it came back short, which is the only
   * end-of-list signal `search3` gives.
   */
  const canLoadMore = (kind: keyof SearchOffsets, shown: number): boolean => {
    if (!enabled || query.isFetching) return false
    const page = SEARCH_PAGE[kind]
    return offsets[kind] > 0 ? shown % page !== 0 : true
  }

  const loadMore = (kind: keyof SearchOffsets, shown: number) => {
    if (shown === 0) return
    setOffsets((current) => ({ ...current, [kind]: current[kind] + SEARCH_PAGE[kind] }))
  }

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
                {results.artists.map((item) => (
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
              <ShowMore
                kind="artist"
                canLoadMore={canLoadMore('artist', results.artists.length)}
                onLoadMore={() => loadMore('artist', results.artists.length)}
                busy={query.isFetching}
              />
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
              <ShowMore
                kind="album"
                canLoadMore={canLoadMore('album', results.albums.length)}
                onLoadMore={() => loadMore('album', results.albums.length)}
                busy={query.isFetching}
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
                    onAddToPlaylist={(items) => requestAddToPlaylist(items.map((item) => item.id))}
                    onStar={onStar}
                    onRate={onRate}
                  />
                ))}
              </div>
              <ShowMore
                kind="song"
                canLoadMore={canLoadMore('song', results.songs.length)}
                onLoadMore={() => loadMore('song', results.songs.length)}
                busy={query.isFetching}
              />
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
              <ShowMore
                kind="playlist"
                canLoadMore={canLoadMore('playlist', results.playlists.length)}
                onLoadMore={() => loadMore('playlist', results.playlists.length)}
                busy={query.isFetching}
              />
            </Section>
          )}
        </div>
      )}
    </div>
  )
}

/** "Show more" for one search section. */
function ShowMore({
  kind,
  canLoadMore,
  onLoadMore,
  busy
}: {
  kind: keyof SearchOffsets
  canLoadMore: boolean
  onLoadMore: () => void
  busy: boolean
}) {
  // A section that came back exactly full might have more; one that came back
  // short is definitely the end, so the button hides itself.
  if (!canLoadMore) return null
  return (
    <div className="pt-2">
      <Button variant="ghost" size="sm" onClick={onLoadMore} disabled={busy}>
        {busy ? 'Loading…' : `Show more ${kind}s`}
      </Button>
    </div>
  )
}
