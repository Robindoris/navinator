import { useQuery } from '@tanstack/react-query'
import { Radio, ExternalLink } from 'lucide-react'
import { getRadioStations } from '../../lib/api'
import { queryKeys, STALE } from '../../lib/query-keys'
import { useServerId } from '../../store/server'
import { PageHeader } from '../shared/Page'
import { EmptyState, ErrorState, Skeleton, Badge } from '../../components/ui/primitives'

/**
 * Internet radio stations configured in Navidrome.
 *
 * These are live streams rather than library tracks, so they are browsed and
 * linked out rather than played through the Subsonic player — Navidrome does
 * not expose them as queueable songs.
 */
export function RadioPage() {
  const serverId = useServerId()
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.radio(serverId!),
    queryFn: getRadioStations,
    enabled: Boolean(serverId),
    staleTime: STALE.library
  })

  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />

  return (
    <div className="space-y-6">
      <PageHeader
        title="Radio"
        subtitle="Internet radio stations shared by your server"
        actions={data?.length ? <Badge>{data.length} stations</Badge> : undefined}
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </div>
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={Radio}
          title="No stations configured"
          description="Add internet radio stations in Navidrome under Settings, or in any Subsonic-compatible client that supports them."
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-app border border-line bg-surface">
          {(data ?? []).map((station: { id: string; name: string; streamUrl: string; homePageUrl?: string }) => (
            <li key={station.id}>
              <a
                href={station.homePageUrl ?? station.streamUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-3">
                  <Radio className="size-4 text-accent" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">{station.name}</span>
                  <span className="block truncate text-xs text-muted">{station.streamUrl}</span>
                </span>
                <ExternalLink className="size-4 shrink-0 text-faint" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
