import { useEffect } from 'react'
import { coverMediaUrl } from '@shared/media'
import { usePlayer } from '../store/player'

/**
 * OS media-key integration and lock-screen metadata.
 *
 * `navigator.mediaSession` is a Chromium web API rather than an Electron
 * module, so the renderer is the only place it can be wired up. Handlers
 * delegate to the same store actions the on-screen buttons use, which keeps
 * the media keys and the visible controls in lockstep.
 */

/** Registered once: reading `usePlayer.getState()` avoids stale closures. */
function registerActionHandlers(): () => void {
  if (!('mediaSession' in navigator)) return () => undefined

  const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
    ['play', () => usePlayer.getState().resume()],
    ['pause', () => usePlayer.getState().pause()],
    ['previoustrack', () => usePlayer.getState().previous()],
    ['nexttrack', () => usePlayer.getState().next()],
    ['stop', () => {
      usePlayer.getState().pause()
      usePlayer.getState().seek(0)
    }],
    ['seekbackward', () => {
      const { position, seek } = usePlayer.getState()
      seek(position - 10)
    }],
    ['seekforward', () => {
      const { position, seek } = usePlayer.getState()
      seek(position + 10)
    }],
    [
      'seekto',
      (details) => {
        if (typeof details.seekTime === 'number') usePlayer.getState().seek(details.seekTime)
      }
    ]
  ]

  for (const [action, handler] of handlers) {
    try {
      navigator.mediaSession.setActionHandler(action, handler)
    } catch {
      // Support varies by action and by Chromium build.
    }
  }

  return () => {
    for (const [action] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, null)
      } catch {
        /* already cleared */
      }
    }
  }
}

export function useMediaSession(): void {
  const song = usePlayer((s) => s.queue[s.index] ?? null)
  const playing = usePlayer((s) => s.playing)
  const position = usePlayer((s) => s.position)
  const duration = usePlayer((s) => s.duration)

  useEffect(() => registerActionHandlers(), [])

  /* Now-playing card shown by the OS (Windows SMTC, macOS, GNOME). */
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    if (!song) {
      navigator.mediaSession.metadata = null
      return
    }
    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.title,
      artist: song.artist ?? undefined,
      album: song.album ?? undefined,
      artwork: song.coverArt ? [{ src: coverMediaUrl(song.coverArt, 512), sizes: '512x512' }] : []
    })
  }, [song])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'
  }, [playing])

  /* Lets the OS scrubber show and move the playhead. */
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    const total = duration || song?.duration || 0
    if (total <= 0 || !Number.isFinite(total)) return
    try {
      navigator.mediaSession.setPositionState({
        duration: total,
        // Chrome rejects a position beyond the duration.
        position: Math.min(Math.max(0, position), total),
        playbackRate: 1
      })
    } catch {
      /* The duration can still be settling; the next tick will succeed. */
    }
  }, [position, duration, song?.duration])
}
