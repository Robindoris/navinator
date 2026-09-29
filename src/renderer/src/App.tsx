import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { AppShell, BootScreen } from './components/layout/AppShell'
import { ConnectScreen } from './features/connect/ConnectScreen'
import { useServer } from './store/server'
import { useSettings } from './store/settings'
import { useMediaSession } from './player/useMediaSession'
import { useAudioSettingsSync, useKeyboardShortcuts } from './player/useShortcuts'
import { bridge } from './lib/bridge'
import { TooltipProvider } from './components/ui/overlays'
import { resolveAccentTheme } from '@shared/themes'

/**
 * Applies the theme to `<html>` and keeps it in sync with the OS when set to
 * "system". Done imperatively so there is no flash of the wrong palette.
 *
 * Mode and colour theme are two independent attributes: `data-theme` picks
 * light/dark, `data-accent` picks the palette. Each palette declares both, so
 * any combination of the two is valid.
 */
function useThemeEffect(): void {
  const theme = useSettings((state) => state.settings.theme)
  const accent = useSettings((state) => state.settings.accent)

  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')

    const apply = () => {
      const resolved = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme
      root.dataset.theme = resolved
      // The persisted value can be from an older version, so it is validated
      // rather than trusted: an unknown id would strip every accent token.
      root.dataset.accent = resolveAccentTheme(accent)
    }

    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme, accent])
}

export function App() {
  const queryClient = useQueryClient()
  const loadSettings = useSettings((state) => state.load)
  const connection = useServer((state) => state.connection)
  const loadProfiles = useServer((state) => state.load)
  const applyConnection = useServer((state) => state.applyConnection)

  useThemeEffect()
  useMediaSession()
  useAudioSettingsSync()
  useKeyboardShortcuts()

  // Load persisted preferences and server list on boot.
  useEffect(() => {
    void loadSettings()
    void loadProfiles()
  }, [loadSettings, loadProfiles])

  // The main process is the source of truth for connection state; it also
  // pushes updates when a library scan or reconnect happens.
  useEffect(() => bridge.on.connectionChanged(applyConnection), [applyConnection])

  // A server switch must not leave another server's data in the cache.
  useEffect(() => {
    if (connection.state === 'disconnected' || connection.state === 'error') {
      queryClient.clear()
    }
  }, [connection.state, queryClient])

  if (connection.state === 'connecting') {
    return (
      <>
        <BootScreen message={`Connecting to ${connection.profile?.name ?? 'your server'}…`} />
        <Toaster />
      </>
    )
  }

  const connected = connection.state === 'connected'

  return (
    <TooltipProvider delayDuration={350}>
      {connected ? <AppShell /> : <ConnectScreen />}
      <Toaster
        position="bottom-center"
        theme={document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'}
        toastOptions={{
          classNames: {
            toast: 'rounded-lg border border-line bg-surface text-fg shadow-lg',
            description: 'text-muted'
          }
        }}
      />
    </TooltipProvider>
  )
}
