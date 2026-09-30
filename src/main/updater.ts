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

/** Long enough for a real diagnosis, short enough to read in a toast. */
const MAX_SUMMARY = 200

/**
 * `autoUpdater` builds its GitHub provider from electron-builder's `publish`
 * block, and that provider resolves "latest" via GitHub's `/releases/latest`.
 * GitHub answers **406** when a repository has no non-prerelease release, so
 * during an alpha period — when every tag is a prerelease, which is what
 * `RELEASING.md` prescribes — the check failed on every single launch.
 *
 * A 406 is not a fault: there genuinely is no newer *stable* build to move to,
 * which is exactly the "up to date" state. Treating it as an error produced a
 * multi-kilobyte console dump on every start and could not produce a useful
 * toast. Prereleases are deliberately not offered as auto-update targets.
 */
function isNoStableRelease(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return (
    /HttpError: 406\b/.test(message) ||
    /ensure a production release exists/i.test(message) ||
    /Cannot parse releases feed/.test(message)
  )
}

/**
 * A failed feed fetch carries the entire HTTP response inside `error.message`:
 * the status line, every `set-cookie`, the CSP header, and often the whole Atom
 * feed. That is several kilobytes of GitHub response headers ending up in a
 * toast description and a console line on every single launch.
 *
 * The useful part is the first line, so only that is surfaced. electron-updater
 * still writes the full error to the terminal itself, so nothing is lost for
 * debugging — this just stops the app from repeating it.
 */
function summarise(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  const firstLine = (raw.split('\n')[0] ?? raw).replace(/^(?:Error:\s*)+/, '').trim()
  if (!firstLine) return 'Could not check for updates'
  return firstLine.length > MAX_SUMMARY
    ? `${firstLine.slice(0, MAX_SUMMARY - 1)}…`
    : firstLine
}

let publish: Publish = () => {}
let wired = false
/** Whether the in-flight check was started by the user rather than on launch. */
let lastCheckWasManual = false
/**
 * `autoUpdater.checkForUpdates()` both rejects *and* emits `error` for a single
 * failure, so handling each independently reported every problem twice. Set
 * while a check is in flight: the first of the two to arrive reports, the
 * second sees the flag and stands down.
 */
let checkInFlight = false

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

/**
 * Single place a failed check turns into user-visible state, so the `error`
 * event and the promise rejection cannot disagree or double up.
 */
function reportCheckFailure(error: unknown, manual: boolean): void {
  if (isNoStableRelease(error)) {
    // Quiet by design: an alpha user has nothing to update to, and saying so on
    // every launch would be noise rather than information.
    console.log('[updater] no published stable release to update to')
    emit({ kind: 'up-to-date' })
    return
  }
  const message = summarise(error)
  console.warn(`[updater] ${message}`)
  emit({ kind: 'error', message, manual })
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
  autoUpdater.on('error', (error) => {
    if (checkInFlight) {
      // The rejection from `checkForUpdates()` carries the same failure and is
      // handled below, with the same outcome.
      return
    }
    reportCheckFailure(error, lastCheckWasManual)
  })
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
  checkInFlight = true
  // Never let an unreachable feed surface as an unhandled rejection.
  void autoUpdater
    .checkForUpdates()
    .catch((error: unknown) => {
      // `manual` is carried through so the renderer can stay quiet about a
      // background check that failed. A repo with no published release answers
      // 406 forever, and toasting about it on every single launch would be
      // indefensible.
      reportCheckFailure(error, manual)
    })
    .finally(() => {
      checkInFlight = false
    })
}

export function quitAndInstall(): void {
  if (!isUpdaterAvailable()) return
  // Audio is stopped first so the deck is not torn down by the restart.
  autoUpdater.quitAndInstall(false, true)
}
