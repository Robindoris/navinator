import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import { config } from './config'

/**
 * Application updates.
 *
 * `electron-updater` needs a real packaged build to work: it reads the
 * `app-update.yml` that electron-builder writes next to the executable, so
 * there is nothing to check in `electron-vite dev`. Every entry point is
 * therefore a no-op outside a packaged app rather than an error.
 *
 * The download is started automatically but never installed without asking —
 * replacing a running music player's binary mid-playback is not a decision the
 * app should make on the user's behalf.
 */

export type UpdateState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'available'; version: string }
  | { kind: 'downloading'; percent: number }
  | { kind: 'downloaded'; version: string }
  | { kind: 'up-to-date' }
  | { kind: 'error'; message: string }

type Publish = (state: UpdateState) => void

let publish: Publish = () => {}
let wired = false

/** Mirrors the current updater status to whichever renderer is listening. */
export function onUpdateState(listener: Publish): void {
  publish = listener
}

function emit(state: UpdateState): void {
  publish(state)
}

export function isUpdaterAvailable(): boolean {
  return app.isPackaged
}

export function wireUpdater(): void {
  if (wired || !isUpdaterAvailable()) return
  wired = true

  // electron-builder's `publish` block is the source of the feed URL, so the
  // app does not hardcode a second copy of it.
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = false

  // An update must never interrupt playback: the user decides when to restart.
  autoUpdater.on('update-available', (info) => emit({ kind: 'available', version: info.version }))
  autoUpdater.on('update-not-available', () => emit({ kind: 'up-to-date' }))
  autoUpdater.on('download-progress', (progress) =>
    emit({ kind: 'downloading', percent: Math.round(progress.percent) })
  )
  autoUpdater.on('update-downloaded', (info) => emit({ kind: 'downloaded', version: info.version }))
  autoUpdater.on('error', (error) =>
    emit({ kind: 'error', message: error instanceof Error ? error.message : String(error) })
  )
}

/** Starts a check, honouring the user's opt-out. */
export function checkForUpdates(manual: boolean): void {
  if (!isUpdaterAvailable()) {
    emit(
      manual
        ? { kind: 'error', message: 'Updates are only available in an installed build.' }
        : { kind: 'idle' }
    )
    return
  }
  if (!manual && !config.getSettings().autoUpdate) return

  emit({ kind: 'checking' })
  // Never let an unreachable feed surface as an unhandled rejection.
  void autoUpdater.checkForUpdates().catch((error: unknown) => {
    emit({ kind: 'error', message: error instanceof Error ? error.message : String(error) })
  })
}

export function quitAndInstall(): void {
  if (!isUpdaterAvailable()) return
  // Audio is stopped first so the deck is not torn down by the restart.
  autoUpdater.quitAndInstall(false, true)
}
