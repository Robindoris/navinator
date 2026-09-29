import { useEffect } from 'react'
import { usePlayer } from '../store/player'
import { useSettings } from '../store/settings'

/**
 * Global keyboard shortcuts.
 *
 * Skipped whenever focus is in a text field, and every binding is ignored
 * while a modifier is held so browser/OS shortcuts (⌘R, ⌘W, ⌘L) keep working.
 */
export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const isTyping = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false
      const tag = target.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (isTyping(event.target)) return
      const player = usePlayer.getState()
      const meta = event.metaKey || event.ctrlKey

      // Let the OS keep ⌘/Ctrl chords.
      if (meta) return

      switch (event.key) {
        case ' ':
          event.preventDefault()
          player.toggle()
          break
        case 'ArrowRight':
          event.preventDefault()
          player.next()
          break
        case 'ArrowLeft':
          event.preventDefault()
          player.previous()
          break
        case 'ArrowUp':
          event.preventDefault()
          player.setVolume(player.volume + 0.05)
          break
        case 'ArrowDown':
          event.preventDefault()
          player.setVolume(player.volume - 0.05)
          break
        case 'm':
          player.toggleMute()
          break
        case 's':
          player.toggleShuffle()
          break
        case 'r':
          player.cycleRepeat()
          break
        case '/':
          event.preventDefault()
          window.dispatchEvent(new CustomEvent('navinator:focus-search'))
          break
        case '?':
          event.preventDefault()
          window.dispatchEvent(new CustomEvent('navinator:show-shortcuts'))
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}

/** Pushes audio settings into the engine whenever they change. */
export function useAudioSettingsSync(): void {
  const audio = useSettings((s) => s.settings.audio)
  const engine = usePlayer((s) => s.engine)

  useEffect(() => {
    engine.update(
      {
        volume: audio.volume,
        muted: audio.muted,
        gapless: audio.gapless,
        crossfade: audio.crossfade,
        transcode: audio.transcode,
        maxBitRate: audio.maxBitRate,
        format: audio.format,
        jukebox: audio.jukebox
      },
      // A codec or bitrate change cannot apply to a stream already in flight,
      // so the current track is re-resolved.
      { reloadOnStreamChange: true }
    )
  }, [engine, audio])
}
