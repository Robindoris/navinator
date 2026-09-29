import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  ListMusic,
  Loader2
} from 'lucide-react'
import { formatDuration } from '../../lib/utils'
import { usePlayer } from '../../store/player'
import { IconButton } from '../ui/primitives'
import { Tooltip, Slider } from '../ui/overlays'
import { CoverArt } from '../items/CoverArt'

const VOLUME_STEPS = 20

export function PlayerBar() {
  const navigate = useNavigate()
  const song = usePlayer((s) => s.queue[s.index] ?? null)
  const playing = usePlayer((s) => s.playing)
  const position = usePlayer((s) => s.position)
  const duration = usePlayer((s) => s.duration)
  const buffered = usePlayer((s) => s.buffered)
  const volume = usePlayer((s) => s.volume)
  const muted = usePlayer((s) => s.muted)
  const shuffle = usePlayer((s) => s.shuffle)
  const repeat = usePlayer((s) => s.repeat)
  const queueCount = usePlayer((s) => s.queue.length)

  const toggle = usePlayer((s) => s.toggle)
  const next = usePlayer((s) => s.next)
  const previous = usePlayer((s) => s.previous)
  const seek = usePlayer((s) => s.seek)
  const setVolume = usePlayer((s) => s.setVolume)
  const toggleMute = usePlayer((s) => s.toggleMute)
  const toggleShuffle = usePlayer((s) => s.toggleShuffle)
  const cycleRepeat = usePlayer((s) => s.cycleRepeat)

  // While the user drags the scrubber we show their value, not the engine's,
  // otherwise the handle fights the pointer.
  const [scrubbing, setScrubbing] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const loadTimer = useRef<number | null>(null)

  const displayPosition = scrubbing ?? position
  const displayDuration = duration || song?.duration || 0

  const commitSeek = useCallback(
    (value: number[]) => {
      const next = value[0]
      setScrubbing(next)
      if (loadTimer.current) window.clearTimeout(loadTimer.current)
      loadTimer.current = window.setTimeout(() => {
        seek(next)
        setScrubbing(null)
      }, 220)
    },
    [seek]
  )

  // Show a spinner for the moment between tapping play and audio starting.
  useEffect(() => {
    if (playing) {
      setLoading(false)
      return
    }
    setLoading(true)
    const timer = window.setTimeout(() => setLoading(false), 1200)
    return () => window.clearTimeout(timer)
  }, [playing, song?.id])

  useEffect(() => () => {
    if (loadTimer.current) window.clearTimeout(loadTimer.current)
  }, [])

  const RepeatIcon = repeat === 'one' ? Repeat1 : Repeat
  const bufferedPct = displayDuration > 0 ? Math.min(100, (buffered / displayDuration) * 100) : 0
  const playedPct = displayDuration > 0 ? Math.min(100, (displayPosition / displayDuration) * 100) : 0

  return (
    <footer className="flex h-[88px] shrink-0 items-center gap-4 border-t border-line bg-surface px-4">
      {/* Now playing */}
      <div className="flex w-[min(22rem,28%)] shrink-0 items-center gap-3">
        <CoverArt
          id={song?.coverArt}
          size={128}
          alt=""
          className="size-14 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div
            role="button"
            tabIndex={0}
            className="truncate text-sm font-medium text-fg hover:underline"
            onClick={() => song?.albumId && navigate({ to: '/album/$albumId', params: { albumId: song.albumId } })}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && song?.albumId) {
                navigate({ to: '/album/$albumId', params: { albumId: song.albumId } })
              }
            }}
          >
            {song?.title ?? 'Nothing playing'}
          </div>
          <div className="truncate text-xs text-muted">
            {song ? (
              <>
                {song.artist ?? 'Unknown artist'}
                {song.album ? ` · ${song.album}` : ''}
              </>
            ) : (
              'Pick something from your library'
            )}
          </div>
          {song?.suffix && (
            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] uppercase text-faint">
              <span>{song.suffix}</span>
              {song.bitRate ? <span>· {song.bitRate} kbps</span> : null}
            </div>
          )}
        </div>
      </div>

      {/* Transport */}
      <div className="flex flex-1 flex-col items-center gap-1">
        <div className="flex items-center gap-1">
          <Tooltip label="Shuffle">
            <IconButton
              label="Shuffle"
              size="icon-sm"
              variant="ghost"
              active={shuffle}
              onClick={toggleShuffle}
            >
              <Shuffle className="size-4" />
            </IconButton>
          </Tooltip>

          <IconButton label="Previous track" size="icon" variant="ghost" onClick={previous}>
            <SkipBack className="size-[18px] fill-current" />
          </IconButton>

          <IconButton
            label={playing ? 'Pause' : 'Play'}
            size="icon"
            variant="primary"
            className="size-11"
            disabled={!song}
            onClick={toggle}
          >
            {loading && !playing ? (
              <Loader2 className="size-5 animate-spin" />
            ) : playing ? (
              <Pause className="size-5 fill-current" />
            ) : (
              <Play className="size-5 translate-x-0.5 fill-current" />
            )}
          </IconButton>

          <IconButton label="Next track" size="icon" variant="ghost" onClick={next}>
            <SkipForward className="size-[18px] fill-current" />
          </IconButton>

          <Tooltip label={repeat === 'off' ? 'Repeat off' : repeat === 'all' ? 'Repeat queue' : 'Repeat track'}>
            <IconButton
              label="Repeat"
              size="icon-sm"
              variant="ghost"
              active={repeat !== 'off'}
              onClick={cycleRepeat}
            >
              <RepeatIcon className="size-4" />
            </IconButton>
          </Tooltip>
        </div>

        {/* Scrubber */}
        <div className="flex w-full max-w-2xl items-center gap-2.5">
          <span className="tabular w-10 text-right text-[11px] text-faint">
            {formatDuration(displayPosition)}
          </span>
          <div className="relative flex-1">
            {/* Buffered bar sits behind the slider track. */}
            <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full">
              <div className="h-full bg-surface-3" style={{ width: `${bufferedPct}%` }} />
              <div className="absolute inset-y-0 left-0 bg-accent/45" style={{ width: `${playedPct}%` }} />
            </div>
            <Slider
              value={[Math.min(displayPosition, displayDuration || displayPosition)]}
              max={displayDuration || 0}
              step={0.5}
              disabled={!song || displayDuration === 0}
              onValueChange={commitSeek}
              className="relative z-10 py-1.5 [&_[role=slider]]:opacity-0"
            />
          </div>
          <span className="tabular w-10 text-[11px] text-faint">{formatDuration(displayDuration)}</span>
        </div>
      </div>

      {/* Volume + queue */}
      <div className="flex w-[min(16rem,20%)] shrink-0 items-center justify-end gap-2">
        <IconButton
          label={muted ? 'Unmute' : 'Mute'}
          size="icon-sm"
          variant="ghost"
          onClick={toggleMute}
        >
          {muted || volume === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </IconButton>
        <div className="w-20">
          <Slider
            value={[muted ? 0 : volume]}
            max={1}
            step={1 / VOLUME_STEPS}
            aria-label="Volume"
            onValueChange={(value) => setVolume(value[0])}
          />
        </div>
        <IconButton
          label="Show queue"
          size="icon-sm"
          variant="ghost"
          onClick={() => navigate({ to: '/queue' })}
        >
          <span className="relative">
            <ListMusic className="size-4" />
            {queueCount > 0 && (
              <span className="tabular absolute -bottom-1.5 -right-2 rounded-full bg-surface-3 px-1 text-[9px] leading-3 text-muted">
                {queueCount}
              </span>
            )}
          </span>
        </IconButton>
      </div>
    </footer>
  )
}
