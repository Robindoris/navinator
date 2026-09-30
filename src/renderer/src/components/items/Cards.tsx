import { memo } from 'react'
import { Play, Pause, Music2, Disc3 } from 'lucide-react'
import type { Album, Artist, Playlist } from '@shared/types'
import { cn, formatTotalDuration, formatYear, formatCount } from '../../lib/utils'
import { CoverArt } from './CoverArt'

type CardVariant = 'album' | 'artist' | 'playlist'

const NOOP = (): void => undefined

interface BaseProps {
  className?: string
  showArt?: boolean
}

interface AlbumCardProps extends BaseProps {
  album: Album
  onOpen: (album: Album) => void
  onPlay: (album: Album) => void
  playCount?: number
  /**
   * Whether this album is the one currently playing. Passed in rather than read
   * from the store so a grid of any size costs one subscription, not N.
   */
  isPlaying?: boolean
  /** Pauses the current track. Only meaningful alongside `isPlaying`. */
  onPause?: () => void
  /** Drops padding and the tertiary metadata line so smaller tiles stay readable. */
  dense?: boolean
}

interface ArtistCardProps extends BaseProps {
  artist: Artist
  onOpen: (artist: Artist) => void
  /**
   * Plays the artist. Optional because most call sites have no track list
   * loaded yet; when omitted the overlay is not rendered rather than silently
   * falling back to navigating.
   */
  onPlay?: (artist: Artist) => void
}

interface PlaylistCardProps extends BaseProps {
  playlist: Playlist
  onOpen: (playlist: Playlist) => void
  onPlay?: (playlist: Playlist) => void
}

/** Subtitle line under a card title, tailored to the entity type. */
function subtitle(
  variant: CardVariant,
  meta: { artist?: string; year?: number; songCount?: number; duration?: number; albumCount?: number; owner?: string }
): string {
  switch (variant) {
    case 'album': {
      const parts = [meta.artist, formatYear(meta.year)].filter(Boolean)
      return parts.join(' · ')
    }
    case 'artist':
      return meta.albumCount ? formatCount(meta.albumCount, 'album') : ''
    case 'playlist': {
      const parts = [meta.owner, meta.songCount ? formatCount(meta.songCount, 'track') : ''].filter(Boolean)
      return parts.join(' · ')
    }
  }
}

/**
 * Hover play button for a card.
 *
 * Cards are `div role="button"` rather than real `<button>` elements precisely so
 * this control can be a real button too: nesting a button inside a button is
 * invalid HTML and makes the inner control's click behaviour unreliable.
 */
function PlayOverlay({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      aria-label={label}
      className={cn(
        'absolute bottom-2 right-2 grid size-9 place-items-center rounded-full bg-accent text-accent-fg',
        'shadow-lg transition-[transform,opacity] duration-200 active:scale-95',
        'opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 focus-visible:opacity-100',
        'group-focus-within:opacity-100 group-focus-within:translate-y-0'
      )}
    >
      <Play className="size-4 translate-x-px fill-current" />
    </button>
  )
}

/** The counterpart shown while this card's own album is the one playing. */
function PauseOverlay({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      aria-label={label}
      className={cn(
        'absolute bottom-2 right-2 grid size-9 place-items-center rounded-full bg-accent text-accent-fg',
        'shadow-lg transition-transform duration-200 active:scale-95',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
      )}
    >
      <Pause className="size-4 translate-x-px fill-current" />
    </button>
  )
}

/* -------------------------------------------------------------------- album */

export const AlbumCard = memo(function AlbumCard({
  album,
  isPlaying = false,
  onOpen,
  onPlay,
  onPause,
  className,
  dense = false
}: AlbumCardProps) {
  // Deliberately no store subscription here. `memo` never shields a component
  // from its own `usePlayer` call, so a per-card subscription meant every
  // play/pause re-rendered all N cards in a grid — on a 10,000-album library
  // that is 10,000 components and their cover children, several times a second
  // during playback. The caller resolves this card's playing state once and
  // passes it down, so a store write touches one subscriber instead of N.
  const showPause = isPlaying

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(album)}
      onDoubleClick={() => onPlay(album)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen(album)
        }
      }}
      className={cn(
        'cv-item group flex w-full flex-col rounded-app text-left transition-colors hover:bg-surface-2',
        'focus-visible:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
        dense ? 'gap-1.5 p-1' : 'gap-2.5 p-2',
        className
      )}
    >
      <div className="relative">
        <CoverArt
          id={album.coverArt}
          size={480}
          alt={album.name}
          className={cn(
            'aspect-square w-full',
            dense ? 'rounded-md' : 'rounded-lg',
            showPause && 'ring-2 ring-accent ring-offset-2 ring-offset-bg'
          )}
        />
        {showPause ? (
          // `onPause` is only absent for a card rendered outside a grid, which
          // cannot be the playing album, so this branch is unreachable there.
          <PauseOverlay label={`Pause ${album.name}`} onClick={onPause ?? NOOP} />
        ) : (
          <PlayOverlay label={`Play ${album.name}`} onClick={() => onPlay(album)} />
        )}
      </div>
      <div className="min-w-0 px-0.5">
        <div className={cn('truncate font-medium text-fg', dense ? 'text-[13px]' : 'text-sm')}>
          {album.name}
        </div>
        <div className={cn('truncate text-muted', dense ? 'text-[11px]' : 'text-xs')}>
          {subtitle('album', album)}
        </div>
        {!dense && album.songCount ? (
          <div className="mt-0.5 truncate text-[11px] text-faint">
            {formatCount(album.songCount, 'track')}
            {album.duration ? ` · ${formatTotalDuration(album.duration)}` : ''}
          </div>
        ) : null}
      </div>
    </div>
  )
})

/* ------------------------------------------------------------------- artist */

export const ArtistCard = memo(function ArtistCard({ artist, onOpen, onPlay, className }: ArtistCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(artist)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen(artist)
        }
      }}
      className={cn(
        'cv-item group flex w-full flex-col items-center gap-2.5 rounded-app p-3 text-center transition-colors hover:bg-surface-2',
        'focus-visible:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
        className
      )}
    >
      <div className="relative w-full">
        <CoverArt
          id={artist.coverArt}
          size={400}
          alt={artist.name}
          rounded="rounded-full"
          className="aspect-square w-full"
        />
        {/* Only shown when the caller can actually start playback — it used to
            fall back to `onOpen`, which made a play button navigate instead. */}
        {onPlay && <PlayOverlay label={`Play ${artist.name}`} onClick={() => onPlay(artist)} />}
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-fg">{artist.name}</div>
        {artist.albumCount ? (
          <div className="truncate text-xs text-muted">{formatCount(artist.albumCount, 'album')}</div>
        ) : null}
      </div>
    </div>
  )
})

/* ----------------------------------------------------------------- playlist */

export const PlaylistCard = memo(function PlaylistCard({
  playlist,
  onOpen,
  onPlay,
  className
}: PlaylistCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(playlist)}
      onDoubleClick={() => onPlay?.(playlist)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen(playlist)
        }
      }}
      className={cn(
        'cv-item group flex w-full flex-col gap-2.5 rounded-app p-2 text-left transition-colors hover:bg-surface-2',
        'focus-visible:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
        className
      )}
    >
      <div className="relative">
        <CoverArt
          id={playlist.coverArt}
          size={400}
          alt={playlist.name}
          className="aspect-square w-full"
        />
        {!playlist.coverArt && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <Disc3 className="size-10 text-faint/40" />
          </div>
        )}
        {onPlay && <PlayOverlay label={`Play ${playlist.name}`} onClick={() => onPlay(playlist)} />}
      </div>
      <div className="min-w-0 px-0.5">
        <div className="truncate text-sm font-medium text-fg">{playlist.name}</div>
        <div className="truncate text-xs text-muted">
          {subtitle('playlist', playlist) || <span className="inline-flex items-center gap-1">Empty</span>}
        </div>
        {playlist.duration ? (
          <div className="mt-0.5 truncate text-[11px] text-faint">{formatTotalDuration(playlist.duration)}</div>
        ) : null}
      </div>
    </div>
  )
})

/** Compact horizontal row used on "Recently added" rails. */
export function MediaRow({
  coverArt,
  title,
  description,
  onClick,
  onPlay,
  icon: Icon = Music2
}: {
  coverArt?: string
  title: string
  description?: string
  onClick: () => void
  onPlay?: () => void
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onDoubleClick={onPlay}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onClick()
      }}
      className="cv-row group flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
    >
      <CoverArt id={coverArt} size={128} alt="" className="size-11 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-fg">{title}</div>
        {description && <div className="truncate text-xs text-muted">{description}</div>}
      </div>
      {onPlay && <PlayOverlay label={`Play ${title}`} onClick={onPlay} />}
      {!coverArt && <Icon className="size-4 shrink-0 text-faint" />}
    </div>
  )
}
