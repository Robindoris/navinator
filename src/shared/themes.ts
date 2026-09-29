/**
 * Named colour themes.
 *
 * Each theme is a *palette*, not a light/dark mode — every one of them ships a
 * light and a dark variant, so you can pick a colour and a mode independently.
 * The actual token values live in `styles/index.css`, keyed by `data-accent`;
 * this module only carries the metadata the settings UI needs to render a
 * labelled swatch.
 *
 * `swatch` colours are duplicated here (rather than read from CSS) so the picker
 * can show a preview without the theme being applied to the document yet.
 */

export const ACCENT_THEMES = [
  {
    id: 'violet',
    label: 'Violet',
    description: 'The default. Soft purple highlights.',
    swatch: ['#8b5cf6', '#c4b5fd']
  },
  {
    id: 'ocean',
    label: 'Ocean',
    description: 'Cool blues with a teal edge.',
    swatch: ['#0ea5e9', '#7dd3fc']
  },
  {
    id: 'emerald',
    label: 'Emerald',
    description: 'Calm green, easy on the eyes.',
    swatch: ['#10b981', '#6ee7b7']
  },
  {
    id: 'amber',
    label: 'Amber',
    description: 'Warm gold, a little brighter.',
    swatch: ['#f59e0b', '#fcd34d']
  },
  {
    id: 'rose',
    label: 'Rose',
    description: 'Pink leaning towards red.',
    swatch: ['#f43f5e', '#fda4af']
  },
  {
    id: 'nord',
    label: 'Nord',
    description: 'Muted arctic blue-grey.',
    swatch: ['#5e81ac', '#88c0d0']
  },
  {
    id: 'citrus',
    label: 'Citrus',
    description: 'Sharp lime, high contrast.',
    swatch: ['#84cc16', '#d9f99d']
  },
  {
    id: 'graphite',
    label: 'Graphite',
    description: 'No colour at all. Just light and dark.',
    swatch: ['#71717a', '#d4d4d8']
  }
] as const

export type AccentTheme = (typeof ACCENT_THEMES)[number]['id']

export const DEFAULT_ACCENT: AccentTheme = 'violet'

const THEME_IDS = new Set<string>(ACCENT_THEMES.map((theme) => theme.id))

/**
 * Guards the value that comes back from disk.
 *
 * `settings.accent` is persisted, and this app has shipped themes before, so an
 * unknown or hand-edited value has to degrade to the default rather than leave
 * the UI with no accent at all.
 */
export function isAccentTheme(value: unknown): value is AccentTheme {
  return typeof value === 'string' && THEME_IDS.has(value)
}

export function resolveAccentTheme(value: unknown): AccentTheme {
  return isAccentTheme(value) ? value : DEFAULT_ACCENT
}
