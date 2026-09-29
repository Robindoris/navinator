import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Type, Music2 } from 'lucide-react'
import type { StructuredLine, StructuredLyric } from '../../lib/api'
import { useLyricsQuery } from '../../features/shared/hooks'
import { usePlayer } from '../../store/player'
import { IconButton, Spinner } from '../ui/primitives'
import { cn } from '../../lib/utils'

/**
 * Synced lyrics for whatever is playing.
 *
 * Three shapes of source data, handled in one place because they arrive
 * together on the same endpoint:
 *
 *  - `synced` with per-line `start` — highlight the active line, click to seek,
 *  - `synced` with `word` timings — highlight the active *word* within the line,
 *  - unsynced plain text — render as-is, no timing at all.
 *
 * The panel is deliberately a side sheet rather than a page: lyrics are only
 * interesting next to the thing that is playing.
 */
export function LyricsPanel({ onClose }: { onClose: () => void }) {
  const songId = usePlayer((s) => s.queue[s.index]?.id)
  const position = usePlayer((s) => s.position)
  const seek = usePlayer((s) => s.seek)

  const { data, isLoading, isFetching } = useLyricsQuery(songId)

  // Servers can return several translations; default to the first and let the
  // user switch without refetching.
  const [langIndex, setLangIndex] = useState(0)
  useEffect(() => setLangIndex(0), [songId])

  const lyric: StructuredLyric | undefined = data?.[langIndex]
  const lines = useMemo(() => lyric?.line ?? [], [lyric])
  const offset = lyric?.offset ?? 0
  const synced = lyric?.synced === true && lines.some((line) => typeof line.start === 'number')

  // Player time minus the lyric's own offset, so a file tagged +200ms lines up.
  const time = Math.max(0, position * 1000 - offset)

  const activeIndex = useMemo(() => {
    if (!synced) return -1
    let found = -1
    for (let i = 0; i < lines.length; i += 1) {
      const start = lines[i].start
      if (typeof start !== 'number') continue
      if (start <= time) found = i
      else break
    }
    return found
  }, [lines, synced, time])

  const scrollRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLParagraphElement>(null)

  // Keep the active line centred. Only the container scrolls, and only when the
  // user is already at the bottom, so scrolling back to read does not fight us.
  useEffect(() => {
    const container = scrollRef.current
    const active = activeRef.current
    if (!container || !active || activeIndex < 0) return
    const target = active.offsetTop - container.clientHeight / 2 + active.clientHeight / 2
    container.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
  }, [activeIndex])

  return (
    <aside className="flex w-[min(26rem,42vw)] shrink-0 flex-col border-l border-line bg-surface">
      <header className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-line px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Type className="size-4 shrink-0 text-faint" />
          <h2 className="truncate text-sm font-semibold text-fg">Lyrics</h2>
          {isFetching && !isLoading && <Spinner className="size-3 shrink-0 text-faint" />}
        </div>
        <IconButton label="Close lyrics" size="icon-sm" variant="ghost" onClick={onClose}>
          <X className="size-4" />
        </IconButton>
      </header>

      {data && data.length > 1 && (
        <div className="flex shrink-0 flex-wrap gap-1 border-b border-line px-4 py-2">
          {data.map((entry, index) => (
            <button
              key={entry.lang ?? String(index)}
              type="button"
              onClick={() => setLangIndex(index)}
              className={cn(
                'rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors',
                index === langIndex ? 'bg-accent-soft text-accent' : 'text-faint hover:text-fg'
              )}
            >
              {entry.lang ?? `#${index + 1}`}
            </button>
          ))}
        </div>
      )}

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <div className="grid h-full place-items-center">
            <Spinner className="size-5" />
          </div>
        ) : !songId ? (
          <p className="py-12 text-center text-sm text-muted">Nothing is playing.</p>
        ) : !lyric || lines.length === 0 ? (
          <div className="grid h-full place-items-center text-center">
            <div className="space-y-2">
              <Music2 className="mx-auto size-6 text-faint/60" />
              <p className="text-sm text-muted">No lyrics for this track.</p>
              <p className="text-xs text-faint">
                Requires a server with the OpenSubsonic <code>songLyrics</code> extension.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {lyric.displayArtist && (
              <p className="pb-1 text-xs font-medium text-muted">{lyric.displayArtist}</p>
            )}
            {lyric.displayTitle && (
              <p className="pb-2 text-xs text-faint">{lyric.displayTitle}</p>
            )}
            {lines.map((line, index) => (
              <LyricLine
                key={`${index}-${line.start ?? 'x'}`}
                line={line}
                active={index === activeIndex}
                time={time}
                onSeek={synced && typeof line.start === 'number' ? () => seek((line.start! + offset) / 1000) : undefined}
                ref={index === activeIndex ? activeRef : undefined}
              />
            ))}
            {!synced && (
              <p className="pt-3 text-[11px] text-faint">These lyrics are not time-synced.</p>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}

function LyricLine({
  line,
  active,
  time,
  onSeek,
  ref
}: {
  line: StructuredLine
  active: boolean
  time: number
  onSeek?: () => void
  ref?: React.Ref<HTMLParagraphElement>
}) {
  const words = line.word

  return (
    <p
      ref={ref}
      onClick={onSeek}
      className={cn(
        'rounded-md px-2 py-1 text-sm leading-relaxed transition-colors',
        active ? 'font-medium text-fg' : 'text-faint',
        onSeek && 'cursor-pointer hover:text-muted'
      )}
    >
      {words?.length
        ? words.map((word, index) => {
            const start = word.start ?? 0
            // A word stays lit until the next one starts; that is how LRC word
            // timings behave in practice.
            const nextStart = words[index + 1]?.start ?? Number.POSITIVE_INFINITY
            return (
              <span
                key={`${index}-${word.value}`}
                className={cn(
                  'transition-colors',
                  active && time >= start && time < nextStart ? 'text-accent' : active ? 'text-fg' : undefined
                )}
              >
                {word.value}{' '}
              </span>
            )
          })
        : line.value}
    </p>
  )
}
