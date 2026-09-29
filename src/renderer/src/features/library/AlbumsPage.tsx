import { useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Disc3, Shuffle, Search as SearchIcon } from 'lucide-react'
import type { AlbumListType } from '../../lib/api'
import { useAlbumListPages, useLibraryNavigation, usePlayAlbum, useShuffleLibrary } from '../shared/hooks'
import { AlbumGrid, PageHeader } from '../shared/Page'
import { Button, ErrorState, Input } from '../../components/ui/primitives'
import { Segmented } from '../../components/ui/overlays'
import { usePlayer } from '../../store/player'
import { type AlbumView } from '../../router'

const VIEWS: { value: AlbumView; label: string }[] = [
  { value: 'newest', label: 'Recently added' },
  { value: 'alphabeticalByName', label: 'Name' },
  { value: 'alphabeticalByArtist', label: 'Artist' },
  { value: 'byYear', label: 'Year' },
  { value: 'frequent', label: 'Most played' },
  { value: 'recent', label: 'Recently played' },
  { value: 'highest', label: 'Top rated' },
  { value: 'random', label: 'Random' }
]

export function AlbumsPage() {
  const navigate = useNavigate()
  // `?view` is validated by the route, so it is always a known value here.
  const { view } = useSearch({ from: '/albums' })
  const { album } = useLibraryNavigation()
  const playAlbum = usePlayAlbum()
  const toggleShuffle = usePlayer((s) => s.toggleShuffle)
  const shuffle = usePlayer((s) => s.shuffle)

  const [filter, setFilter] = useState('')

  const query = useAlbumListPages(view as AlbumListType)
  const shufflePool = useShuffleLibrary(query.albums.map((item) => item.id))
  const sentinel = useRef<HTMLDivElement>(null)

  // Pull the next page when the bottom of the list comes into view. The button
  // stays as a fallback for anyone who never quite reaches the end.
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query
  useEffect(() => {
    const node = sentinel.current
    if (!node) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return
        if (hasNextPage && !isFetchingNextPage) void fetchNextPage()
      },
      { rootMargin: '600px' }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // Filtering is client side: the loaded pages are already in memory, and a
  // request per keystroke against `search3` would be both slower and worse for
  // the server than matching locally over what has been fetched.
  const albums = useMemo(() => {
    const all = query.albums
    if (!filter.trim()) return all
    const needle = filter.trim().toLowerCase()
    return all.filter(
      (item) =>
        item.name?.toLowerCase().includes(needle) ||
        item.artist?.toLowerCase().includes(needle) ||
        String(item.year ?? '').includes(needle)
    )
  }, [query.albums, filter])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Albums"
        subtitle={
          query.albums.length
            ? `${query.albums.length}${query.hasNextPage ? '+' : ''} in your library`
            : 'Loading your library…'
        }
        actions={
          <>
            <Button
              variant={shuffle ? 'subtle' : 'ghost'}
              onClick={() => {
                if (!shuffle) toggleShuffle()
                void shufflePool()
              }}
              disabled={query.albums.length === 0}
            >
              <Shuffle className="size-4" />
              Shuffle all
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          value={view}
          onChange={(next) => navigate({ to: '/albums', search: { view: next } })}          options={VIEWS.map((item) => ({ value: item.value, label: item.label }))}
        />
        <div className="relative min-w-52 flex-1">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <Input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter these albums…"
            className="pl-8"
            aria-label="Filter albums"
          />
        </div>
      </div>

      {query.error ? (
        <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />
      ) : (
        <AlbumGrid
          albums={albums}
          loading={query.isLoading}
          onOpen={(item) => album(item.id)}
          onPlay={(item) => void playAlbum(item.id, item)}
          emptyMessage={filter ? 'No albums match that filter.' : 'No albums here yet.'}
        />
      )}

      {!query.isLoading && albums.length > 0 && (
        <div
          ref={sentinel}
          className="flex flex-col items-center gap-3"
        >
          {query.hasNextPage && (
            <Button
              variant="secondary"
              onClick={() => void query.fetchNextPage()}
              disabled={query.isFetchingNextPage}
              loading={query.isFetchingNextPage}
            >
              Load more
            </Button>
          )}
          <p className="flex items-center gap-1.5 text-xs text-faint">
            <Disc3 className="size-3.5" />
            Double-click an album to play it straight through.
          </p>
        </div>
      )}
    </div>
  )
}
