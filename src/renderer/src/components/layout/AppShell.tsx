import { useEffect } from 'react'
import { Outlet, useNavigate } from '@tanstack/react-router'
import { Sidebar } from './Sidebar'
import { TitleBar } from './TitleBar'
import { PlayerBar } from './PlayerBar'
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

  return (
    <div className="flex h-full flex-col overflow-hidden bg-bg">
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[100rem] px-6 py-6">
            <Outlet />
          </div>
        </main>
      </div>
      <PlayerBar />
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
