import { useRef } from 'react'
import { Check } from 'lucide-react'
import { ACCENT_THEMES, type AccentTheme } from '@shared/themes'
import { cn } from '../../lib/utils'

/**
 * Colour theme picker.
 *
 * The swatches are painted from the literal colours in `ACCENT_THEMES` rather
 * than from the live CSS variables, because the whole point of this control is
 * to preview a theme that is not applied yet — reading the current value would
 * make every swatch identical.
 */
export function ThemePicker({
  value,
  onChange
}: {
  value: AccentTheme
  onChange: (value: AccentTheme) => void
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  /**
   * A `radiogroup` is one tab stop and arrow keys move between options. This
   * already declared `role="radiogroup"` / `role="radio"`, so without the
   * roving tabindex all eight swatches were separate tab stops and the group
   * violated the very contract it advertised.
   */
  const onKeyDown = (event: React.KeyboardEvent, index: number): void => {
    const count = ACCENT_THEMES.length
    const last = count - 1
    let next: number | null = null
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = index === last ? 0 : index + 1
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = index === 0 ? last : index - 1
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = last
    if (next === null) return
    event.preventDefault()
    onChange(ACCENT_THEMES[next].id)
    refs.current[next]?.focus()
  }

  return (
    <div role="radiogroup" aria-label="Colour theme" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {ACCENT_THEMES.map((theme, index) => {
        const selected = theme.id === value
        return (
          <button
            key={theme.id}
            ref={(node) => {
              refs.current[index] = node
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            // Roving tabindex: one tab stop for the whole group.
            tabIndex={selected ? 0 : -1}
            title={theme.description}
            onClick={() => onChange(theme.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              'group flex items-center gap-2.5 rounded-app border p-2 text-left transition-colors',
              'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-strong',
              selected
                ? 'border-accent bg-accent-soft'
                : 'border-line bg-surface-2 hover:border-faint hover:bg-surface-3'
            )}
          >
            <span
              aria-hidden
              className="grid size-8 shrink-0 place-items-center rounded-full"
              style={{ background: `linear-gradient(135deg, ${theme.swatch[0]}, ${theme.swatch[1]})` }}
            >
              {selected && <Check className="size-4 text-white drop-shadow" strokeWidth={3} />}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  'block truncate text-xs font-medium',
                  selected ? 'text-accent-strong' : 'text-fg'
                )}
              >
                {theme.label}
              </span>
              <span className="block truncate text-[11px] text-faint">{theme.description}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
