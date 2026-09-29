import { useMemo, useState } from 'react'
import { Search as SearchIcon, Users } from 'lucide-react'
import { toast } from 'sonner'
import { useArtistsQuery, useLibraryNavigation, usePlayArtist } from '../shared/hooks'
import { PageHeader } from '../shared/Page'
import { ArtistCard } from '../../components/items/Cards'
import { EmptyState, ErrorState, Input, Skeleton } from '../../components/ui/primitives'
import { formatCount } from '../../lib/utils'

export function ArtistsPage() {
  const { artist } = useLibraryNavigation()
  const { data, isLoading, error, refetch } = useArtistsQuery()
  const playArtist = usePlayArtist()
  const [filter, setFilter] = useState('')

  const indices = useMemo(() => {
    const groups = data ?? []
    if (!filter.trim()) return groups
    const needle = filter.trim().toLowerCase()
    const matched = groups
      .map((group) => ({
        ...group,
        artist: group.artist.filter((item) => item.name.toLowerCase().includes(needle))
      }))
      .filter((group) => group.artist.length > 0)
    return matched
  }, [data, filter])

  const total = useMemo(() => (data ?? []).reduce((sum, group) => sum + group.artist.length, 0), [data])

  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />

  return (
    <div className="space-y-6">
      <PageHeader title="Artists" subtitle={total ? formatCount(total, 'artist') : undefined} />

      <div className="relative max-w-sm">
        <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
        <Input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter artists…"
          className="pl-8"
          aria-label="Filter artists"
          autoFocus
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-1">
          {Array.from({ length: 18 }, (_, index) => (
            <div key={index} className="space-y-2 p-3">
              <Skeleton className="aspect-square w-full rounded-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      ) : indices.length === 0 ? (
        <EmptyState
          icon={Users}
          title={filter ? 'No artists match that filter' : 'No artists found'}
          description={
            filter ? 'Try a shorter search.' : 'Once Navidrome has scanned your library they will appear here.'
          }
        />
      ) : (
        <div className="space-y-8">
          {indices.map((group) => (
            <section key={group.name} className="space-y-3">
              <h2 className="text-lg font-semibold tracking-tight text-fg">{group.name}</h2>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-1">
                {group.artist.map((item) => (
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
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
