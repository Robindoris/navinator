import { app } from 'electron'
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { UpdateState } from '@shared/types'
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

/**
 * `electron-updater` is CommonJS, and this package is `"type": "module"`, so
 * the bundled main process is ESM. A named import of a CJS module only works if
 * the loader can statically detect that name — Node's `cjs-module-lexer`
 * manages it, but Electron's ESM loader does not, and the packaged app dies at
 * startup with:
 *
 *   SyntaxError: Named export 'autoUpdater' not found.
 *
 * A default import is not a safe substitute either: it hands back the wrong
 * shape and fails later with `Cannot read properties of undefined (reading
 * 'getVersion')`.
 *
 * `createRequire` sidesteps ESM interop entirely and uses real CJS semantics in
 * both runtimes, so the load order and lazy getters inside the module are
 * preserved.
 */
const require = createRequire(import.meta.url)
const { autoUpdater } = require('electron-updater') as typeof import('electron-updater')

type Publish = (state: UpdateState) => void

let publish: Publish = () => {}
let wired = false
/** Whether the in-flight check was started by the user rather than on launch. */
let lastCheckWasManual = false

/** Mirrors the current updater status to whichever renderer is listening. */
export function onUpdateState(listener: Publish): void {
  publish = listener
}

function emit(state: UpdateState): void {
  publish(state)
}

/**
 * True only when this build can actually check for updates.
 *
 * `app.isPackaged` alone is not enough: an unpacked `electron-builder --dir`
 * build is "packaged" but has no `app-update.yml` next to the executable,
 * because that file is only written into a real distributable. Checking for the
 * file keeps a development build from logging an ENOENT and showing the user a
 * "could not check for updates" toast for something they never asked about.
 */
export function isUpdaterAvailable(): boolean {
  if (!app.isPackaged) return false
  return (
    existsSync(join(process.resourcesPath, 'app-update.yml')) ||
    existsSync(join(app.getAppPath(), 'app-update.yml'))
  )
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
    emit({
      kind: 'error',
      message: error instanceof Error ? error.message : String(error),
      manual: lastCheckWasManual
    })
  )
}

/** Starts a check, honouring the user's opt-out. */
export function checkForUpdates(manual: boolean): void {
  if (!isUpdaterAvailable()) {
    emit(
      manual
        ? { kind: 'error', message: 'Updates are only available in an installed build.', manual: true }
        : { kind: 'idle' }
    )
    return
  }
  if (!manual && !config.getSettings().autoUpdate) return

  lastCheckWasManual = manual
  emit({ kind: 'checking' })
  // Never let an unreachable feed surface as an unhandled rejection.
  void autoUpdater
    .checkForUpdates()
    .catch((error: unknown) => {
      // `manual` is carried through so the renderer can stay quiet about a
      // background check that failed. A repo with no published release answers
      // 406 forever, and toasting about it on every single launch would be
      // indefensible.
      emit({
        kind: 'error',
        message: error instanceof Error ? error.message : String(error),
        manual
      })
    })
}

export function quitAndInstall(): void {
  if (!isUpdaterAvailable()) return
  // Audio is stopped first so the deck is not torn down by the restart.
  autoUpdater.quitAndInstall(false, true)
}
