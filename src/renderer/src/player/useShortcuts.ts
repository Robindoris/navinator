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

    /**
     * Anything that owns the key we are about to handle.
     *
     * Two real bugs hide here if this is only `isTyping`:
     *
     *  1. Space activates buttons and links on *keyup*, via the browser's
     *     default action on keydown. A global handler that calls
     *     `preventDefault()` on Space therefore cancels activation for every
     *     button, link and switch in the app and plays the track instead.
     *  2. Radix's Slider handles arrow keys on its Root and calls
     *     `preventDefault()` but not `stopPropagation()`, so the event still
     *     reaches `window` — arrowing the *volume* slider would also skip the
     *     track, and arrowing the *seek* slider would change the volume.
     *
     * So the transport keys are ignored whenever focus sits on a widget that
     * legitimately consumes them.
     */
    const ownsKey = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false
      return (
        isTyping(target) ||
        target.closest(
          'button, a[href], [role="button"], [role="slider"], [role="switch"], [role="checkbox"], [role="radio"], [role="tab"], [role="option"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="combobox"], [role="listbox"], [role="spinbutton"], [role="textbox"], [contenteditable="true"]'
        ) !== null
      )
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      const player = usePlayer.getState()
      const meta = event.metaKey || event.ctrlKey

      // Let the OS keep ⌘/Ctrl chords.
      if (meta) return

      // Focus is inside a widget that has its own meaning for these keys.
      if (ownsKey(event.target)) return

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
