import { memo } from 'react'
import { Play, Pause, Heart, MoreHorizontal, ListPlus, Timer, Star } from 'lucide-react'
import type { Song } from '@shared/types'
import { cn, formatDuration, formatCount, formatBitrate, formatBytes } from '../../lib/utils'
import { usePlayer } from '../../store/player'
import { IconButton } from '../ui/primitives'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Tooltip
} from '../ui/overlays'
import { CoverArt } from './CoverArt'

interface TrackActions {
  /**
   * Starts playback at this row.
   *
   * Required: without it a row has no way to know which list it belongs to, so
   * pressing play on a track in an album, playlist, genre or search result would
   * silently do nothing.
   */
  onPlay: (index: number) => void
  onPlayNext?: (songs: Song[]) => void
  onAddToQueue?: (songs: Song[]) => void
  onAddToPlaylist?: (songs: Song[]) => void
  onStar?: (song: Song) => void
  /** Sets a 1–5 star rating; 0 clears it. */
  onRate?: (song: Song, rating: number) => void
  onGoToAlbum?: (song: Song) => void
  onGoToArtist?: (song: Song) => void
  onDownload?: (song: Song) => void
}

interface TrackRowProps extends TrackActions {
  song: Song
  index: number
  album?: { name?: string; artist?: string; coverArt?: string }
  /** Queue position, when the list is the play queue rather than an album. */
  queueIndex?: number
  showAlbum?: boolean
  showArt?: boolean
  showIndex?: boolean
  showDuration?: boolean
  /** Highlight the row if it is the currently playing track. */
  isActive?: boolean
  onRemove?: () => void
}

/**
 * A single row in any track list.
 *
 * Memoised because a 5,000-song genre view re-renders on every `timeupdate`
 * from the player; without this the whole list would reconcile ~4 times a
 * second.
 */
export const TrackRow = memo(function TrackRow({
  song,
  index,
  album,
  queueIndex,
  showAlbum = false,
  showArt = true,
  showIndex = true,
  showDuration = true,
  isActive = false,
  onPlay,
  onPlayNext,
  onAddToQueue,
  onAddToPlaylist,
  onStar,
  onRate,
  onGoToAlbum,
  onGoToArtist,
  onDownload,
  onRemove
}: TrackRowProps) {
  const playing = usePlayer((s) => s.playing)
  const currentId = usePlayer((s) => (s.queue[s.index]?.id ?? null))
  const toggle = usePlayer((s) => s.toggle)
  const jumpTo = usePlayer((s) => s.jumpTo)
  const isCurrent = currentId === song.id
  const showPauseIcon = isCurrent && playing

  /**
   * Three distinct intents, and getting them confused is what made the play
   * button feel dead:
   *
   *  - the current track toggles between play and pause,
   *  - a row inside the play queue jumps to its own position, because the queue
   *    may have been reordered since the list was rendered,
   *  - anything else starts the surrounding list at this row.
   */
  const activate = () => {
    if (isCurrent) return toggle()
    if (queueIndex !== undefined) return jumpTo(queueIndex)
    onPlay(index)
  }

  return (
    <div
      // Was `role="row"`, which is only valid inside a `table`/`grid`/`rowgroup`
      // and requires `role="cell"` children. These rows are plain divs in a
      // plain div, so screen readers silently discarded the role and the
      // intended semantics never surfaced. A named, focusable element that
      // describes the track is both valid and more useful than a fake row.
      tabIndex={0}
      aria-label={
        `${song.title}${song.artist ? `, ${song.artist}` : ''}` +
        `${song.album ? `, from ${song.album}` : ''}`
      }
      onDoubleClick={activate}
      onKeyDown={(event) => {
        // Enter mirrors double-click, which runs the same `activate`.
        if (event.key === 'Enter') activate()
      }}
      className={cn(
        'cv-row group grid h-11 items-center gap-3 rounded-md px-2 text-sm transition-colors',
        'hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
        isActive && 'bg-accent-soft/60',
        onRemove && 'pr-1'
      )}
      style={{
        gridTemplateColumns: showArt
          ? '2rem 2.5rem minmax(0,1fr) auto auto'
          : '2rem minmax(0,1fr) auto auto'
      }}
    >
      {/* Play button / track number */}
      <div className="flex items-center justify-end">
        {showIndex && (
          <span
            className={cn(
              'tabular w-6 text-right text-xs text-faint group-hover:hidden',
              isCurrent && 'hidden group-hover:block'
            )}
          >
            {queueIndex !== undefined ? queueIndex + 1 : (song.track ?? index + 1)}
          </span>
        )}
        <button
          type="button"
          onClick={activate}
          aria-label={showPauseIcon ? `Pause ${song.title}` : `Play ${song.title}`}
          className={cn(
            // `group-focus-within` matters as much as `group-hover`: the button
            // is `hidden` otherwise, so a keyboard user would tab onto an
            // invisible control.
            'hidden size-7 place-items-center rounded-full text-fg transition-colors',
            'hover:bg-surface-3 group-hover:grid group-focus-within:grid',
            showPauseIcon && '!grid text-accent-strong'
          )}
        >
          {showPauseIcon ? <Pause className="size-3.5 fill-current" /> : <Play className="size-3.5 fill-current" />}
        </button>
      </div>

      {/* Artwork */}
      {showArt && (
        <CoverArt
          id={song.coverArt ?? album?.coverArt}
          size={96}
          alt=""
          rounded="rounded"
          className="size-8"
        />
      )}

      {/* Title / artist / album */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn('truncate font-medium', isCurrent ? 'text-accent-strong' : 'text-fg')}>{song.title}</span>
          {song.userRating !== undefined && song.userRating > 0 && (
            <span className="shrink-0 text-[10px] text-accent-strong" title={`Your rating: ${song.userRating}/5`}>
              ★{song.userRating}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 truncate text-xs text-muted">
          {onGoToArtist && song.artist && !song.isRadio ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onGoToArtist(song)
              }}
              className="truncate hover:text-fg hover:underline"
            >
              {song.artist}
            </button>
          ) : (
            <span className="truncate">{song.artist ?? 'Unknown artist'}</span>
          )}
          {showAlbum && album?.name && !song.isRadio && (
            <>
              <span aria-hidden>·</span>
              {onGoToAlbum ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onGoToAlbum(song)
                  }}
                  className="truncate hover:text-fg hover:underline"
                >
                  {album.name}
                </button>
              ) : (
                <span className="truncate">{album.name}</span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Technical detail, only on wide rows */}
      <span className="tabular hidden text-xs text-faint lg:block">
        {formatBitrate(song.bitRate) || formatBytes(song.size)}
      </span>

      {/* Duration / play count / menu */}
      <div className="flex items-center justify-end gap-1">
        {showDuration && (
          <span className="tabular w-10 text-right text-xs text-faint">
            {song.playCount ? formatCount(song.playCount, 'play') : formatDuration(song.duration)}
          </span>
        )}
        {onStar && !song.isRadio && (
          <Tooltip label={song.starred ? 'Remove from favourites' : 'Add to favourites'}>
            <IconButton
              label="Favourite"
              size="icon-xs"
              variant="ghost"
              className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
              active={song.starred !== undefined}
              onClick={(event) => {
                event.stopPropagation()
                onStar(song)
              }}
            >
              <Heart className={cn('size-3.5', song.starred ? 'fill-current text-accent-strong' : '')} />
            </IconButton>
          </Tooltip>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton
              label="More actions"
              size="icon-xs"
              variant="ghost"
              className="opacity-0 focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
              onClick={(event) => event.stopPropagation()}
            >
              <MoreHorizontal className="size-3.5" />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {onPlayNext && (
              <DropdownMenuItem icon={ListPlus} onSelect={() => onPlayNext([song])}>
                Play next
              </DropdownMenuItem>
            )}
            {onAddToQueue && (
              <DropdownMenuItem icon={Timer} onSelect={() => onAddToQueue([song])}>
                Add to queue
              </DropdownMenuItem>
            )}
            {onAddToPlaylist && !song.isRadio && (
              <DropdownMenuItem icon={ListPlus} onSelect={() => onAddToPlaylist([song])}>
                Add to playlist
              </DropdownMenuItem>
            )}
            {onStar && !song.isRadio && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  icon={Heart}
                  onSelect={() => onStar(song)}
                >
                  {song.starred ? 'Remove from favourites' : 'Add to favourites'}
                </DropdownMenuItem>
              </>
            )}
            {onRate && !song.isRadio && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-fg outline-none select-none data-[highlighted]:bg-surface-2">
                    <Star className="size-4 shrink-0 opacity-70" />
                    {song.userRating ? `Rated ${song.userRating}/5` : 'Rate'}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <DropdownMenuItem
                        key={rating}
                        onSelect={() => onRate(song, rating)}
                        className={cn(
                          song.userRating === rating && 'text-accent-strong'
                        )}
                      >
                        <span aria-hidden>{'★'.repeat(rating)}</span>
                        <span className="sr-only">Rate {rating} out of 5</span>
                      </DropdownMenuItem>
                    ))}
                    {song.userRating ? (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => onRate(song, 0)}>Clear rating</DropdownMenuItem>
                      </>
                    ) : null}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </>
            )}
            {onDownload && song.suffix && !song.starred && !song.isRadio && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => onDownload(song)}>
                  Download {song.suffix.toUpperCase()}
                </DropdownMenuItem>
              </>
            )}
            {onRemove && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem danger onSelect={onRemove}>
                  Remove from queue
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
})

/** Column headings matching `TrackRow`'s grid. */
export function TrackHeader({
  showArt = true,
  showIndex = true,
  showDuration = true
}: {
  showArt?: boolean
  showIndex?: boolean
  showDuration?: boolean
}) {
  return (
    <div
      // Decorative column labels. Each row carries its own `aria-label`, so
      // exposing this as a table header would imply a table that does not
      // exist and re-announce the column names on every row.
      aria-hidden="true"
      className="grid h-8 items-center gap-3 border-b border-line px-2 text-[11px] font-semibold uppercase tracking-wide text-faint"
      style={{
        gridTemplateColumns: showArt
          ? '2rem 2.5rem minmax(0,1fr) auto auto'
          : '2rem minmax(0,1fr) auto auto'
      }}
    >
      <span className={showIndex ? 'text-right' : ''}>#</span>
      {showArt && <span />}
      <span>Title</span>
      <span className="hidden lg:block">Quality</span>
      <span className="text-right">{showDuration ? 'Time' : ''}</span>
    </div>
  )
}
