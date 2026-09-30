import { useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { useServer, useServerId } from '../../store/server'
import { usePlayer } from '../../store/player'
import { queryKeys } from '../../lib/query-keys'
import { cn } from '../../lib/utils'
import { IconButton } from '../ui/primitives'
import { Tooltip } from '../ui/overlays'
import { Button } from '../ui/primitives'

/**
 * Custom title bar.
 *
 * The window keeps the platform frame on Windows and Linux but uses a
 * hidden-inset title bar on macOS, so this strip has to be draggable and must
 * not swallow clicks on the controls it contains.
 */
export function TitleBar() {
  const queryClient = useQueryClient()
  const serverId = useServerId()
  const profile = useServer((s) => s.connection.profile)
  const state = useServer((s) => s.connection.state)
  const serverVersion = useServer((s) => s.connection.serverVersion)
  const queueCount = usePlayer((s) => s.queue.length)
  const disconnect = useServer((s) => s.disconnect)
  const isMac = navigator.platform.toLowerCase().includes('mac')

  return (
    <header
      className={cn(
        'app-drag flex h-11 shrink-0 items-center gap-3 border-b border-line bg-surface px-4',
        isMac && 'pl-[5.5rem]'
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <img src="./navinator.png" alt="" aria-hidden className="size-5 shrink-0 rounded" />
        <span className="text-sm font-semibold tracking-tight text-fg">Navinator</span>
        {profile && (
          <>
            <span className="text-faint" aria-hidden>
              /
            </span>
            <span className="truncate text-sm text-muted">{profile.name}</span>
            {state === 'connected' && serverVersion && (
              <span className="hidden shrink-0 text-[11px] text-faint sm:inline">
                v{serverVersion.split(' ')[0]}
              </span>
            )}
          </>
        )}
      </div>

      {queueCount > 0 && state === 'connected' && (
        <span className="app-no-drag hidden shrink-0 text-[11px] text-faint sm:inline">
          {queueCount} in queue
        </span>
      )}

      <div className="app-no-drag flex shrink-0 items-center gap-1.5">
        {state === 'connected' && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              // A server switch invalidates every cached query, so drop the
              // whole cache rather than risk showing the previous library.
              queryClient.clear()
              void disconnect()
            }}
          >
            Switch server
          </Button>
        )}
        <Tooltip label="Refresh library">
          <IconButton
            label="Refresh"
            size="icon-sm"
            variant="ghost"
            onClick={() => {
              // Scoped to the active server on purpose. A bare
              // `invalidateQueries()` marks every query stale, and for
              // `useInfiniteQuery` that means refetching every loaded page
              // sequentially — 100 requests on a fully scrolled 10k library for
              // a button labelled "Refresh". Still not enough on its own for
              // the album list, which is fetched in pages and cannot be
              // refetched "all at once" by react-query.
              if (!serverId) return
              void queryClient.invalidateQueries({ queryKey: queryKeys.root(serverId) })
            }}
          >
            <RefreshCw className="size-4" />
          </IconButton>
        </Tooltip>
      </div>
    </header>
  )
}
