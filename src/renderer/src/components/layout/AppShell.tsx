import { useEffect, useState } from 'react'
import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { Sidebar } from './Sidebar'
import { TitleBar } from './TitleBar'
import { PlayerBar } from './PlayerBar'
import { ShortcutsDialog } from './ShortcutsDialog'
import { LyricsPanel } from './LyricsPanel'
import { AddToPlaylistHost } from '../items/AddToPlaylistDialog'
import { bridge } from '../../lib/bridge'
import type { MenuAction } from '@shared/types'
import { usePlayer } from '../../store/player'
import { Spinner } from '../ui/primitives'

/**
 * Main application chrome: title bar, sidebar, scrolling content and the
 * persistent player bar. Renders only while a server connection is active —
 * `App` decides between this and the connect screen.
 */
export function AppShell() {
  const navigate = useNavigate()
  const [lyricsOpen, setLyricsOpen] = useState(false)
  const restoreQueue = usePlayer((s) => s.restoreQueue)

  useEffect(() => {
    // The shell only mounts once a server is connected, so this runs exactly
    // once per connection and never fires on the connect screen.
    void restoreQueue()
  }, [restoreQueue])

  useEffect(() => {
    // Menu items are forwarded from the main process as semantic actions so the
    // renderer stays the single owner of playback state.
    return bridge.on.menuAction((action: MenuAction) => {
      const player = usePlayer.getState()
      switch (action) {
        case 'play-pause':
          player.toggle()
          break
        case 'next':
          player.next()
          break
        case 'previous':
          player.previous()
          break
        case 'seek-forward':
          player.seek(player.position + 10)
          break
        case 'seek-backward':
          player.seek(player.position - 10)
          break
        case 'volume-up':
          player.setVolume(player.volume + 0.1)
          break
        case 'volume-down':
          player.setVolume(player.volume - 0.1)
          break
        case 'shuffle-toggle':
          player.toggleShuffle()
          break
        case 'repeat-toggle':
          player.cycleRepeat()
          break
        case 'clear-queue':
          player.clearQueue()
          break
        case 'settings':
          navigate({ to: '/settings' })
          break
        case 'show':
          window.focus()
          break
      }
    })
  }, [navigate])

  // Route changes move the whole page, so focus has to move with it. TanStack
  // Router does not do this, and without it a keyboard user who activates a
  // sidebar item keeps focus on that button while the content changes silently
  // behind them. `preventScroll` keeps the new page where it was rendered.
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  useEffect(() => {
    document.getElementById('main-content')?.focus({ preventScroll: true })
  }, [pathname])

  // `/` is documented as "jump to search" and the page tells the user it works
  // "anywhere" — but the only listener lived inside SearchPage, which unmounts
  // on every other route, so the shortcut silently did nothing unless you were
  // already on the search page.
  //
  // This only handles the navigation half. When we are already on `/search`,
  // SearchPage's own listener focuses the input; when we are not, navigating
  // mounts it with `autoFocus`, which does the same thing. Deliberately *not*
  // re-dispatching the event here — that would loop.
  useEffect(() => {
    if (pathname === '/search') return
    const jump = (): void => void navigate({ to: '/search' })
    window.addEventListener('navinator:focus-search', jump)
    return () => window.removeEventListener('navinator:focus-search', jump)
  }, [pathname, navigate])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-bg">
      {/* A 500-row track list is thousands of tab stops, and the player bar sits
          after it in the DOM — so without this, reaching playback by keyboard
          means tabbing through the entire library. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:text-accent-fg focus:outline-2 focus:outline-offset-2 focus:outline-accent-strong"
      >
        Skip to content
      </a>
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        {/* The only <main> in the app. `tabIndex={-1}` makes it focusable as a
            skip target, and the `id` gives the skip link something to point at. */}
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 overflow-y-auto focus:outline-none">
          <div className="mx-auto max-w-[100rem] px-6 py-6">
            <Outlet />
          </div>
        </main>
        {lyricsOpen && <LyricsPanel onClose={() => setLyricsOpen(false)} />}
      </div>
      <PlayerBar lyricsOpen={lyricsOpen} onToggleLyrics={() => setLyricsOpen((open) => !open)} />
      <ShortcutsDialog />
      <AddToPlaylistHost />
    </div>
  )
}

/** Full-bleed loading state shown while the first connection is attempted. */
export function BootScreen({ message }: { message: string }) {
  return (
    <div className="grid h-full place-items-center bg-bg">
      <div className="flex flex-col items-center gap-3">
        <Spinner className="size-6" />
        <p className="text-sm text-muted">{message}</p>
      </div>
    </div>
  )
}
