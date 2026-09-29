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
  return (
    <div role="radiogroup" aria-label="Colour theme" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {ACCENT_THEMES.map((theme) => {
        const selected = theme.id === value
        return (
          <button
            key={theme.id}
            type="button"
            role="radio"
            aria-checked={selected}
            title={theme.description}
            onClick={() => onChange(theme.id)}
            className={cn(
              'group flex items-center gap-2.5 rounded-app border p-2 text-left transition-colors',
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
                  selected ? 'text-accent' : 'text-fg'
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
