import { useEffect, useState } from 'react'
import { SHORTCUTS, SHORTCUT_GROUPS } from '@shared/shortcuts'
import { Dialog, DialogContent } from '../ui/overlays'

/**
 * Keyboard shortcut reference, opened with `?`.
 *
 * Mounted once in `AppShell` and driven by the `navinator:show-shortcuts`
 * event that `useKeyboardShortcuts` dispatches. It is a controlled dialog
 * rather than a `DialogTrigger`, because a global keydown has no element to
 * hang a trigger off.
 */
export function ShortcutsDialog() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const show = (): void => setOpen(true)
    window.addEventListener('navinator:show-shortcuts', show)
    return () => window.removeEventListener('navinator:show-shortcuts', show)
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        title="Keyboard shortcuts"
        description="Shortcuts stand down while a text field has focus, and whenever ⌘ or Ctrl is held so system chords keep working."
        className="w-[min(38rem,calc(100vw-2rem))]"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          {SHORTCUT_GROUPS.map((group) => {
            const items = SHORTCUTS.filter((shortcut) => shortcut.group === group)
            if (items.length === 0) return null
            return (
              <section key={group} className="space-y-1.5">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-faint">
                  {group}
                </h3>
                <dl className="space-y-0.5">
                  {items.map((shortcut) => (
                    <div
                      key={`${shortcut.group}-${shortcut.keys}-${shortcut.label}`}
                      className="flex items-baseline justify-between gap-3 rounded-md px-1 py-1 odd:bg-surface-2/60"
                    >
                      <dt className="min-w-0 text-xs text-muted">{shortcut.label}</dt>
                      <dd className="shrink-0">
                        <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-fg">
                          {shortcut.keys}
                        </kbd>
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
