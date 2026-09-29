import { create } from 'zustand'
import type { RepeatMode, Song } from '@shared/types'
import { AudioEngine } from '../player/engine'
import { clamp, shuffleArray } from '../lib/utils'
import { useSettings } from './settings'
import { scrobble, reportPlayback, savePlayQueue } from '../lib/api'

/**
 * Rules for when a track counts as "played" for Last.fm/Navidrome.
 *
 * Navidrome deliberately does not mark a song played when it is merely
 * streamed, so these scrobbles are the only thing that advances play counts.
 */
const SCROBBLE_AFTER_FRACTION = 0.5
const SCROBBLE_AFTER_SECONDS = 240

interface PlaybackReportState {
  positionMs: number
  state: 'starting' | 'playing' | 'paused' | 'stopped'
}

interface PlayerState {
  engine: AudioEngine
  queue: Song[]
  /** The order the queue was built in, so shuffle can be undone. */
  original: Song[]
  index: number
  playing: boolean
  position: number
  duration: number
  buffered: number
  volume: number
  muted: boolean
  shuffle: boolean
  repeat: RepeatMode
  /** Songs the user explicitly started, as opposed to auto-advanced. */
  scrobbled: Set<string>

  /* actions */
  playQueue: (songs: Song[], startIndex?: number) => void
  playNow: (songs: Song[], startIndex?: number) => void
  toggle: () => void
  pause: () => void
  resume: () => void
  next: () => void
  previous: () => void
  seek: (seconds: number) => void
  setVolume: (volume: number) => void
  toggleMute: () => void
  toggleShuffle: () => void
  cycleRepeat: () => void
  jumpTo: (index: number) => void
  removeAt: (index: number) => void
  moveInQueue: (from: number, to: number) => void
  clearQueue: () => void
  addToQueue: (songs: Song[], playNext?: boolean) => void
  playNextInQueue: (songs: Song[]) => void
  stop: () => void
}

/** One engine per renderer session; the store only orchestrates it. */
export const engine = new AudioEngine()

function qualifiesForScrobble(position: number, duration: number, alreadyScrobbled: boolean): boolean {
  if (alreadyScrobbled) return false
  if (duration <= 0) return false
  return position >= Math.min(duration * SCROBBLE_AFTER_FRACTION, SCROBBLE_AFTER_SECONDS) || position >= duration * 0.9
}

/** Fire-and-forget reporting: never let telemetry break playback. */
function safely(label: string, run: () => Promise<unknown>): void {
  void run().catch((error) => {
    if (useSettings.getState().settings.audio.playbackReport) {
      console.warn(`[player] ${label} failed`, error)
    }
  })
}

export const usePlayer = create<PlayerState>((set, get) => {
  /* ------------------------------------------------------ engine bindings */

  engine.on('trackChange', (index) => {
    set({ index })
    const report = get().scrobbled
    set({ scrobbled: new Set(report) })
    reportCurrentPlayback('starting')
    scheduleHeartbeat()
  })

  engine.on('stateChange', (playing) => {
    set({ playing })
    reportCurrentPlayback(playing ? 'playing' : 'paused')
    if (playing) scheduleHeartbeat()
  })

  engine.on('progress', (currentTime, duration, buffered) => {
    set({ position: currentTime, duration, buffered })

    const { scrobbled } = get()
    const song = get().queue[get().index]
    if (!song) return

    if (qualifiesForScrobble(currentTime, duration, scrobbled.has(song.id))) {
      set({ scrobbled: new Set(scrobbled).add(song.id) })
      const audio = useSettings.getState().settings.audio
      if (audio.scrobble) safely('scrobble', () => scrobble(song.id, true))
    }

    // Persist roughly every 15 seconds so a crash loses little progress.
    if (Math.floor(currentTime) % 15 === 0) persistQueue()
  })

  engine.on('ended', () => {
    finishCurrentPlayback('stopped')
    const { repeat, index, queue } = get()
    const atEnd = index >= queue.length - 1

    if (repeat === 'one' && queue.length > 0) {
      engine.jumpTo(index, true)
      return
    }
    if (atEnd && repeat === 'off') {
      engine.pause()
      persistQueue()
      return
    }
    advance()
  })

  engine.on('error', (message) => {
    // A single unplayable file should not end the session: skip it.
    console.warn('[player]', message)
    advance()
  })

  /* ------------------------------------------------------------- helpers */

  function currentSong(): Song | null {
    return get().queue[get().index] ?? null
  }

  function reportCurrentPlayback(state: PlaybackReportState['state']): void {
    if (!useSettings.getState().settings.audio.playbackReport) return
    const song = currentSong()
    if (!song) return
    const positionMs = Math.round(get().position * 1000)
    safely('reportPlayback', () => reportPlayback({ mediaId: song.id, state, positionMs, playbackRate: 1 }))
  }

  function finishCurrentPlayback(state: 'stopped'): void {
    const song = currentSong()
    if (!song) return
    const positionMs = Math.round(get().position * 1000)
    if (!useSettings.getState().settings.audio.playbackReport) return
    safely('reportPlayback:stop', () => reportPlayback({ mediaId: song.id, state, positionMs }))
  }

  /** Navidrome's `playbackReport` extension wants a periodic heartbeat. */
  let heartbeat: number | null = null
  function scheduleHeartbeat(): void {
    if (heartbeat !== null) clearInterval(heartbeat)
    const audio = useSettings.getState().settings.audio
    if (!audio.playbackReport) return
    heartbeat = window.setInterval(() => {
      if (get().playing) reportCurrentPlayback('playing')
    }, 20_000)
  }

  function persistQueue(): void {
    const { queue, index, position, shuffle } = get()
    if (queue.length === 0) return
    // Saving the shuffled order would permanently reshuffle the server-side
    // queue, so only the canonical order is written back.
    const ids = shuffle ? get().original.map((s) => s.id) : queue.map((s) => s.id)
    safely('savePlayQueue', () => savePlayQueue(ids, queue[index]?.id, Math.round(position * 1000)))
  }

  function advance(): void {
    const { repeat, shuffle, queue, index } = get()
    if (shuffle) {
      const next = pickRandomIndex(index, queue.length)
      if (next !== null) {
        engine.jumpTo(next, true)
        return
      }
    }
    if (index + 1 < queue.length) {
      engine.advanceAfterEnd()
      return
    }
    if (repeat === 'all' && queue.length > 0) {
      engine.jumpTo(0, true)
      return
    }
    engine.pause()
  }

  function pickRandomIndex(current: number, length: number): number | null {
    if (length <= 1) return null
    let next = current
    for (let attempt = 0; attempt < 20 && next === current; attempt++) {
      next = Math.floor(Math.random() * length)
    }
    return next === current ? (current + 1) % length : next
  }

  /* -------------------------------------------------------------- store */

  return {
    engine,
    queue: [],
    original: [],
    index: -1,
    playing: false,
    position: 0,
    duration: 0,
    buffered: 0,
    volume: useSettings.getState().settings.audio.volume,
    muted: useSettings.getState().settings.audio.muted,
    shuffle: false,
    repeat: 'off',
    scrobbled: new Set(),

    /** Replaces the queue and starts playing at `startIndex`. */
    playQueue: (songs, startIndex = 0) => {
      if (songs.length === 0) return
      const state = get()
      const queue = state.shuffle ? shuffleArray(songs) : songs
      // When shuffling, find where the requested track landed rather than
      // assuming it stayed at `startIndex`.
      const index = state.shuffle
        ? Math.max(0, queue.findIndex((s) => s.id === songs[startIndex]?.id))
        : startIndex
      set({ queue, original: songs, index, scrobbled: new Set() })
      engine.setQueue(queue, index, true)
    },

    /** Same as `playQueue` but jumps to a track and plays it immediately. */
    playNow: (songs, startIndex = 0) => get().playQueue(songs, startIndex),

    toggle: () => engine.toggle(),
    pause: () => engine.pause(),
    resume: () => engine.play(),

    next: () => {
      const { repeat, shuffle, index, queue } = get()
      if (shuffle) {
        const next = pickRandomIndex(index, queue.length)
        if (next !== null) return engine.jumpTo(next, true)
      }
      if (index + 1 < queue.length) return engine.skip(1, true)
      if (repeat === 'all' && queue.length > 0) return engine.jumpTo(0, true)
      engine.pause()
    },

    /**
     * Mirrors the behaviour of every other music player: if you are more than
     * a few seconds in, "previous" restarts the track instead of going back.
     */
    previous: () => {
      if (get().position > 3) return engine.seek(0)
      if (get().index > 0) return engine.skip(-1, true)
      engine.seek(0)
    },

    seek: (seconds) => engine.seek(seconds),

    setVolume: (volume) => {
      const next = clamp(volume, 0, 1)
      engine.setVolume(next)
      if (next > 0 && get().muted) engine.setMuted(false)
      set({ volume: next, muted: next === 0 ? get().muted : false })
      void useSettings.getState().patch({ audio: { volume: next } })
    },

    toggleMute: () => {
      const muted = !get().muted
      engine.setMuted(muted)
      set({ muted })
      void useSettings.getState().patch({ audio: { muted } })
    },

    toggleShuffle: () => {
      const state = get()
      const shuffle = !state.shuffle
      set({ shuffle })

      if (state.queue.length === 0) return
      if (shuffle) {
        // Keep the current track first so playback is not interrupted, then
        // shuffle everything after it.
        const current = state.queue[state.index]
        const rest = state.queue.filter((_, i) => i !== state.index)
        const queue = current ? [current, ...shuffleArray(rest)] : shuffleArray(rest)
        set({ queue })
        engine.setQueue(queue, 0, state.playing)
      } else if (state.original.length > 0) {
        const current = state.queue[state.index]
        const queue = state.original
        const index = Math.max(0, queue.findIndex((s) => s.id === current?.id))
        set({ queue, index })
        engine.setQueue(queue, index, state.playing)
      }
    },

    cycleRepeat: () => {
      const order: RepeatMode[] = ['off', 'all', 'one']
      const repeat = order[(order.indexOf(get().repeat) + 1) % order.length]
      set({ repeat })
    },

    jumpTo: (index) => engine.jumpTo(index, true),

    removeAt: (target) => {
      const state = get()
      if (target < 0 || target >= state.queue.length) return
      const isCurrent = target === state.index
      const queue = state.queue.filter((_, i) => i !== target)
      const original = state.original.filter((s) => s.id !== state.queue[target].id)
      set({ queue, original })

      if (queue.length === 0) return state.stop()
      if (isCurrent) {
        const next = Math.min(target, queue.length - 1)
        set({ index: next })
        engine.jumpTo(next, state.playing)
      } else {
        // The engine's index shifts when an earlier item is removed.
        set({ index: state.index > target ? state.index - 1 : state.index })
        engine.setQueue(queue, get().index, state.playing)
      }
    },

    moveInQueue: (from, to) => {
      const state = get()
      if (from === to || from < 0 || to < 0) return
      if (from >= state.queue.length || to >= state.queue.length) return
      const queue = [...state.queue]
      const [moved] = queue.splice(from, 1)
      queue.splice(to, 0, moved)
      const index = state.index === from ? to : state.index > from && to >= state.index ? state.index - 1 : state.index
      set({ queue, index })
      engine.setQueue(queue, index, state.playing)
    },

    clearQueue: () => {
      finishCurrentPlayback('stopped')
      engine.destroy()
      set({
        queue: [],
        original: [],
        index: -1,
        playing: false,
        position: 0,
        duration: 0,
        buffered: 0
      })
      safely('savePlayQueue', () => savePlayQueue([]))
    },

    addToQueue: (songs, playNext = false) => {
      const state = get()
      if (songs.length === 0) return
      if (state.queue.length === 0) {
        set({ queue: songs, original: songs, index: 0 })
        engine.setQueue(songs, 0, false)
        return
      }
      const queue = playNext
        ? [...state.queue.slice(0, state.index + 1), ...songs, ...state.queue.slice(state.index + 1)]
        : [...state.queue, ...songs]
      const index = state.index
      set({ queue, original: [...state.original, ...songs] })
      engine.setQueue(queue, index, state.playing)
    },

    playNextInQueue: (songs) => get().addToQueue(songs, true),

    stop: () => {
      finishCurrentPlayback('stopped')
      engine.pause()
      engine.seek(0)
      set({ playing: false, position: 0 })
    }
  }
})
