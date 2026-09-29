import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merges class names, letting later Tailwind utilities win over earlier ones. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/* ------------------------------------------------------------------ format */

/** `1:04:09` for hours, `4:07` otherwise. Negative/NaN input renders as `--:--`. */
export function formatDuration(seconds: number | undefined | null): string {
  if (seconds === undefined || seconds === null || !Number.isFinite(seconds) || seconds < 0) {
    return '--:--'
  }
  const total = Math.round(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/** Total runtime of a track list, e.g. `1 hr 12 min`. */
export function formatTotalDuration(seconds: number | undefined): string {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  if (h > 0) return m > 0 ? `${h} hr ${m} min` : `${h} hr`
  return `${m} min`
}

export function formatBytes(bytes: number | undefined): string {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value < 10 && unit > 0 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`
}

export function formatBitrate(bitRate: number | undefined): string {
  if (!bitRate || bitRate <= 0) return ''
  // Navidrome reports kbps for `bitRate`.
  return `${bitRate} kbps`
}

/** Play counts and the like: `1 play`, `4 plays`, `1.2k plays`. */
export function formatCount(count: number | undefined, singular: string, plural = `${singular}s`): string {
  if (count === undefined || count === null) return ''
  if (count === 1) return `1 ${singular}`
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k ${plural}`
  return `${count} ${plural}`
}

export function formatYear(date: string | number | undefined | null): string {
  if (!date) return ''
  if (typeof date === 'number') return String(date)
  const parsed = new Date(date)
  return Number.isNaN(parsed.getTime()) ? '' : String(parsed.getFullYear())
}

/** "3 days ago" style label used on recently-played lists. */
export function formatRelative(value: string | number | Date | undefined): string {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  const ms = Date.now() - date.getTime()
  if (Number.isNaN(ms)) return ''
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks} week${weeks === 1 ? '' : 's'} ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatCountdown(seconds: number | undefined): string {
  if (seconds === undefined || seconds < 0) return ''
  if (seconds < 60) return `${Math.ceil(seconds)}s left`
  return `${formatDuration(seconds)} left`
}

/* ------------------------------------------------------------------ shuffle */

/** Fisher–Yates on a copy; never mutates the input. */
export function shuffleArray<T>(items: readonly T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/** Deduplicates by a key while preserving order. */
export function uniqueBy<T>(items: readonly T[], key: (item: T) => string): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const item of items) {
    const k = key(item)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(item)
  }
  return out
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/* ------------------------------------------------------------------- misc */

/** Groups album tracks into discs so a multi-disc release renders correctly. */
export function groupByDisc<T extends { discNumber?: number; track?: number }>(items: readonly T[]): {
  discNumber: number
  title: string
  songs: T[]
}[] {
  const discs = new Map<number, T[]>()
  for (const item of items) {
    const disc = item.discNumber ?? 1
    const list = discs.get(disc)
    if (list) list.push(item)
    else discs.set(disc, [item])
  }
  return [...discs.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([discNumber, songs]) => ({
      discNumber,
      title: `Disc ${discNumber}`,
      songs: [...songs].sort((a, b) => (a.track ?? 0) - (b.track ?? 0))
    }))
}

/** Stable id for cache keys and list keys. */
export const songKey = (song: { id: string }): string => song.id
