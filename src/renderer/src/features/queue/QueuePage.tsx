import { ListMusic, Trash2, Play, Pause, Shuffle, Repeat, GripVertical, X } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '../shared/Page'
import { Button, EmptyState, IconButton, Badge } from '../../components/ui/primitives'
import { Tooltip } from '../../components/ui/overlays'
import { TrackRow, TrackHeader } from '../../components/items/TrackRow'
import { CoverArt } from '../../components/items/CoverArt'
import { usePlayer } from '../../store/player'
import { useLibraryNavigation, useTrackAnnotations } from '../shared/hooks'
import { formatDuration, formatTotalDuration } from '../../lib/utils'
import { useState } from 'react'

/**
 * The play queue.
 *
 * Mirrors the engine's own state rather than keeping a second copy, so there is
 * exactly one source of truth for what is playing and in what order.
 */
export function QueuePage() {
  const queue = usePlayer((s) => s.queue)
  const index = usePlayer((s) => s.index)
  const playing = usePlayer((s) => s.playing)
  const shuffle = usePlayer((s) => s.shuffle)
  const repeat = usePlayer((s) => s.repeat)
  const toggle = usePlayer((s) => s.toggle)
  const jumpTo = usePlayer((s) => s.jumpTo)
  const removeAt = usePlayer((s) => s.removeAt)
  const clearQueue = usePlayer((s) => s.clearQueue)
  const toggleShuffle = usePlayer((s) => s.toggleShuffle)
  const cycleRepeat = usePlayer((s) => s.cycleRepeat)
  const addToQueue = usePlayer((s) => s.addToQueue)
  const playNext = usePlayer((s) => s.playNextInQueue)
  const { onStar, onRate } = useTrackAnnotations()
  const { artist, album: openAlbum } = useLibraryNavigation()

  const [dragging, setDragging] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<number | null>(null)

  const totalSeconds = queue.reduce((sum, song) => sum + (song.duration ?? 0), 0)
  const current = queue[index]

  if (queue.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Queue" />
        <EmptyState
          icon={ListMusic}
          title="Your queue is empty"
          description="Play an album, artist or playlist and the queue will fill up here."
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Queue"
        subtitle={`${queue.length} tracks · ${formatTotalDuration(totalSeconds)}`}
        actions={
          <>
            <Button variant={shuffle ? 'subtle' : 'ghost'} onClick={toggleShuffle}>
              <Shuffle className="size-4" />
              Shuffle
            </Button>
            <Button variant={repeat !== 'off' ? 'subtle' : 'ghost'} onClick={cycleRepeat}>
              <Repeat className="size-4" />
              {repeat === 'one' ? 'Repeat one' : repeat === 'all' ? 'Repeat all' : 'Repeat off'}
            </Button>
            <Button variant="ghost" onClick={clearQueue}>
              <Trash2 className="size-4" />
              Clear
            </Button>
          </>
        }
      />

      {/* Current track strip */}
      {current && (
        <div className="flex items-center gap-4 rounded-app border border-line bg-surface p-3">
          <CoverArt id={current.coverArt} size={160} alt="" className="size-16 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium text-fg">{current.title}</span>
              {index >= 0 && <Badge tone="accent">#{index + 1}</Badge>}
            </div>
            <div className="truncate text-xs text-muted">{current.artist ?? 'Unknown artist'}</div>
          </div>
          <IconButton
            label={playing ? 'Pause' : 'Play'}
            size="icon"
            variant="primary"
            onClick={toggle}
          >
            {playing ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
          </IconButton>
        </div>
      )}

      <div className="space-y-1">
        <TrackHeader />
        {queue.map((song, position) => (
          <div
            key={`${song.id}-${position}`}
            draggable
            onDragStart={() => setDragging(position)}
            onDragOver={(event) => {
              event.preventDefault()
              // Guarded like `PlaylistsPage`: `onDragOver` fires continuously
              // while the pointer is inside a row, and an unguarded
              // `setDropTarget` re-renders every row in the queue each time —
              // which on a long queue turns a single drag into a full-list
              // reconcile per boundary crossed.
              if (dropTarget !== position) setDropTarget(position)
            }}
            onDragEnd={() => {
              setDragging(null)
              setDropTarget(null)
            }}
            onDrop={() => {
              if (dragging !== null && dragging !== position) {
                // `moveInQueue` is the one action the engine store exposes for
                // reordering without disturbing playback.
                usePlayer.getState().moveInQueue(dragging, position)
              }
              setDragging(null)
              setDropTarget(null)
            }}
            className={
              dropTarget === position ? 'rounded-md ring-1 ring-accent' : 'rounded-md'
            }
          >
            <div
              className="group flex items-center"
              onKeyDown={(event) => {
                // HTML5 drag-and-drop is not keyboard-operable, so reordering
                // the queue was impossible without a mouse. Alt+Arrow moves the
                // focused row and keeps focus on it.
                if (!event.altKey) return
                const delta = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0
                if (delta === 0) return
                const target = position + delta
                if (target < 0 || target >= queue.length) return
                event.preventDefault()
                usePlayer.getState().moveInQueue(position, target)
                // The row moves in the DOM, so restore focus to its new slot.
                requestAnimationFrame(() => {
                  document
                    .querySelector<HTMLElement>(`[data-queue-row="${target}"]`)
                    ?.querySelector<HTMLElement>('[data-queue-handle]')
                    ?.focus()
                })
              }}
            >
              <div
                data-queue-handle
                tabIndex={0}
                role="button"
                aria-label={`Reorder ${song.title}. Position ${position + 1} of ${queue.length}. Use Alt with the arrow keys to move.`}
                className="flex w-6 shrink-0 cursor-grab items-center justify-center rounded text-faint opacity-0 transition-opacity focus-visible:opacity-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-accent-strong group-hover:opacity-100 active:cursor-grabbing"
              >
                <GripVertical className="size-3.5" />
              </div>
              <div className="min-w-0 flex-1" data-queue-row={position}>
                <TrackRow
                  song={song}
                  index={position}
                  queueIndex={position}
                  isActive={position === index}
                  showAlbum
                  album={{ name: song.album, coverArt: song.coverArt }}
                  onPlay={(target) => jumpTo(target)}
                  onGoToAlbum={() => song.albumId && openAlbum(song.albumId)}
                  onGoToArtist={() => song.artistId && artist(song.artistId)}
                  onPlayNext={(items) => playNext(items)}
                  onAddToQueue={(items) => addToQueue(items)}
                  onStar={onStar}
                  onRate={onRate}
                  onRemove={() => removeAt(position)}
                />
              </div>
              {position === index && (
                <Tooltip label="Remove" side="left">
                  <IconButton
                    label="Remove from queue"
                    size="icon-xs"
                    variant="ghost"
                    className="mr-1 shrink-0 opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                    onClick={() => removeAt(position)}
                  >
                    <X className="size-3.5" />
                  </IconButton>
                </Tooltip>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2 text-xs text-faint">
        <span>{formatDuration(totalSeconds)} total</span>
        <button
          type="button"
          onClick={() => {
            clearQueue()
            toast.message('Queue cleared')
          }}
          className="hover:text-fg"
        >
          Clear queue
        </button>
      </div>
    </div>
  )
}
