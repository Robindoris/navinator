import { useQuery } from '@tanstack/react-query'
import { Radio, ExternalLink, Play, Pause, ListPlus, Timer } from 'lucide-react'
import { toast } from 'sonner'
import type { Song } from '@shared/types'
import { getRadioStations } from '../../lib/api'
import { queryKeys, STALE } from '../../lib/query-keys'
import { useServerId } from '../../store/server'
import { usePlayer } from '../../store/player'
import { PageHeader } from '../shared/Page'
import { Button, EmptyState, ErrorState, Skeleton, Badge, IconButton } from '../../components/ui/primitives'
import { Tooltip } from '../../components/ui/overlays'

interface Station {
  id: string
  name: string
  streamUrl: string
  homePageUrl?: string
}

/**
 * Turns a station into something the queue can hold.
 *
 * A station has no track on the server, so it borrows the `Song` shape with
 * `isRadio` set. The engine routes those to the media proxy by station id, and
 * every annotation the server cannot accept is gated on the same flag.
 */
function toSong(station: Station): Song {
  return {
    id: station.id,
    title: station.name,
    artist: 'Internet radio',
    isRadio: true,
    streamUrl: station.streamUrl,
    homePageUrl: station.homePageUrl
  }
}

/**
 * Internet radio stations configured in Navidrome.
 *
 * Stations are played in-app by the same two-deck engine as everything else —
 * the media proxy resolves the station id to its stream URL server-side, so no
 * arbitrary URL is ever fetched from the page. The homepage link is kept
 * alongside, because a station page is often more interesting than the stream.
 */
export function RadioPage() {
  const serverId = useServerId()
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.radio(serverId!),
    queryFn: getRadioStations,
    enabled: Boolean(serverId),
    staleTime: STALE.library
  })

  const currentId = usePlayer((s) => s.queue[s.index]?.id ?? null)
  const playing = usePlayer((s) => s.playing)
  const toggle = usePlayer((s) => s.toggle)
  const playQueue = usePlayer((s) => s.playQueue)
  const addToQueue = usePlayer((s) => s.addToQueue)
  const playNext = usePlayer((s) => s.playNextInQueue)

  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />

  const stations: Station[] = data ?? []

  const playStation = (station: Station) => {
    if (currentId === station.id) {
      toggle()
      return
    }
    // Play the station on its own rather than dumping every station into the
    // queue: a live stream is an end in itself, and shuffling into an endless
    // stream list is rarely what was meant.
    playQueue([toSong(station)], 0)
  }

  const playAll = () => {
    if (stations.length === 0) return
    playQueue(stations.map(toSong), 0)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Radio"
        subtitle="Internet radio stations shared by your server"
        actions={
          stations.length > 0 ? (
            <>
              <Button onClick={playAll}>Play all</Button>
              <Badge>{stations.length} stations</Badge>
            </>
          ) : undefined
        }
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </div>
      ) : stations.length === 0 ? (
        <EmptyState
          icon={Radio}
          title="No stations configured"
          description="Add internet radio stations in Navidrome under Settings, or in any Subsonic-compatible client that supports them."
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-app border border-line bg-surface">
          {stations.map((station) => {
            const isCurrent = currentId === station.id
            return (
              <li key={station.id} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2">
                <button
                  type="button"
                  onClick={() => playStation(station)}
                  aria-label={isCurrent ? `Pause ${station.name}` : `Play ${station.name}`}
                  className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-3 text-accent transition-colors hover:bg-surface-2"
                >
                  {isCurrent && playing ? (
                    <Pause className="size-4 fill-current" />
                  ) : (
                    <Play className="size-4 translate-x-px fill-current" />
                  )}
                </button>

                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm font-medium ${isCurrent ? 'text-accent' : 'text-fg'}`}>
                    {station.name}
                  </span>
                  <span className="block truncate text-xs text-muted">{station.streamUrl}</span>
                </span>

                <span className="flex shrink-0 items-center gap-1">
                  <Tooltip label="Play next">
                    <IconButton
                      label="Play next"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => playNext([toSong(station)])}
                    >
                      <ListPlus className="size-4" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip label="Add to queue">
                    <IconButton
                      label="Add to queue"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => addToQueue([toSong(station)])}
                    >
                      <Timer className="size-4" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip label="Open station page">
                    <IconButton
                      label="Open station page"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => {
                        try {
                          void window.open(station.homePageUrl ?? station.streamUrl, '_blank', 'noopener')
                        } catch {
                          toast.error('Could not open that link')
                        }
                      }}
                    >
                      <ExternalLink className="size-4" />
                    </IconButton>
                  </Tooltip>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
