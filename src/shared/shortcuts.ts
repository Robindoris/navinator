/**
 * Single source of truth for every keyboard binding in the app.
 *
 * The in-window shortcuts come from `useKeyboardShortcuts`, the menu
 * accelerators from `main/menu.ts`, and the Settings page renders a reference
 * table. All three used to be written out separately, which is how `?` ended up
 * dispatching an event nobody listened to while the Settings table quietly
 * omitted it. Anything a user can press is listed here exactly once.
 */

export interface Shortcut {
  group: ShortcutGroup
  /** How the keys are drawn, e.g. `Space` or `⌘/Ctrl + ,`. */
  keys: string
  label: string
}

export type ShortcutGroup = 'Playback' | 'Navigation' | 'Interface'

export const SHORTCUTS: readonly Shortcut[] = [
  // In-window bindings. See `player/useShortcuts.ts` for the implementation and
  // for the rules that make them stand down (text fields, and any ⌘/Ctrl chord).
  { group: 'Playback', keys: 'Space', label: 'Play / pause' },
  { group: 'Playback', keys: '→', label: 'Next track' },
  { group: 'Playback', keys: '←', label: 'Previous track, or restart if past 3s' },
  { group: 'Playback', keys: '↑ / ↓', label: 'Volume up / down' },
  { group: 'Playback', keys: 'M', label: 'Mute' },
  { group: 'Playback', keys: 'S', label: 'Toggle shuffle' },
  { group: 'Playback', keys: 'R', label: 'Cycle repeat mode' },

  { group: 'Navigation', keys: '/', label: 'Jump to search' },
  { group: 'Navigation', keys: 'Esc', label: 'Clear search' },
  { group: 'Navigation', keys: '⌘/Ctrl + ,', label: 'Settings' },
  { group: 'Navigation', keys: '?', label: 'Show this list' },

  // Menu accelerators. See `main/menu.ts`.
  { group: 'Interface', keys: '⌘/Ctrl + ⇧ + ←', label: 'Seek backward 10s' },
  { group: 'Interface', keys: '⌘/Ctrl + ⇧ + →', label: 'Seek forward 10s' },
  { group: 'Interface', keys: '⌘/Ctrl + ↑ / ↓', label: 'Volume up / down' },
  { group: 'Interface', keys: '⌘/Ctrl + S', label: 'Toggle shuffle' },
  { group: 'Interface', keys: '⌘/Ctrl + R', label: 'Cycle repeat mode' },
  { group: 'Interface', keys: '⌘/Ctrl + Delete', label: 'Clear queue' }
] as const

export const SHORTCUT_GROUPS: readonly ShortcutGroup[] = [
  'Playback',
  'Navigation',
  'Interface'
] as const
