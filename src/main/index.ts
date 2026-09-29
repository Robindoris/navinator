import { BrowserWindow, app, ipcMain } from 'electron'
import { MUTATING_METHODS, isApiMethod, type ApiMethod } from '@shared/api-methods'
import type {
  AppInfo,
  AppSettings,
  ConnectionInfo,
  MenuAction,
  ProbeResult,
  ServerProfile,
  ServerProfileInput
} from '@shared/types'
import { config, isEncryptionAvailable } from './config'
import { installMenu } from './menu'
import { checkForUpdates, isUpdaterAvailable, onUpdateState, quitAndInstall, wireUpdater } from './updater'
import { registerMediaProtocol, registerMediaScheme } from './protocol'
import { connection } from './server'
import { createMainWindow, getMainWindow } from './window'

/**
 * Ordering guarantee for write endpoints.
 *
 * The renderer fires scrobbles and playlist edits without awaiting them, and
 * Subsonic servers apply requests in arrival order. Chaining mutating calls
 * onto a single promise chain keeps a `star` from overtaking the `scrobble` that
 * was issued before it.
 */
let writeQueue: Promise<unknown> = Promise.resolve()

function enqueueWrite<T>(task: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(task, task)
  // Swallow rejections on the chain itself, otherwise one failed write poisons
  // every write that follows it.
  writeQueue = result.catch(() => undefined)
  return result
}

/* ------------------------------------------------------------------ events */

function sendToRenderer(channel: 'connection:changed' | 'menu:action' | 'update:state', payload: unknown): void {
  const window = getMainWindow()
  if (!window || window.isDestroyed()) return
  window.webContents.send(channel, payload)
}

// The connection owns the authoritative state; mirror every transition to the
// renderer so a failed reconnect or a library change cannot leave it stale.
connection.setChangeListener((info: ConnectionInfo) => {
  sendToRenderer('connection:changed', info)
})

function installMenuActions(): void {
  installMenu((action: MenuAction) => {
    if (action === 'show') {
      const window = getMainWindow()
      if (!window) return
      if (window.isMinimized()) window.restore()
      window.show()
      window.focus()
      return
    }
    sendToRenderer('menu:action', action)
  })
}

/* --------------------------------------------------------------------- IPC */

function handle(channel: string, handler: (...args: never[]) => unknown): void {
  ipcMain.handle(channel, (_event, ...args) => handler(...(args as never[])))
}

function registerIpcHandlers(): void {
  handle('app:info', (): AppInfo => {
    return {
      version: app.getVersion(),
      platform: process.platform,
      isPackaged: app.isPackaged,
      encryptionAvailable: isEncryptionAvailable()
    }
  })

  /* ------------------------------------------------------------- servers */

  handle('servers:list', (): ServerProfile[] => config.listProfiles())

  handle('servers:save', (input: ServerProfileInput): ServerProfile[] => {
    const profiles = config.upsertProfile(input)
    // Renaming or editing the live profile must be reflected without a
    // reconnect, so refresh the cached copy the media proxy signs URLs with.
    const active = connection.getInfo().profile
    if (active && profiles.some((p) => p.id === active.id)) {
      const refreshed = profiles.find((p) => p.id === active.id)
      if (refreshed) connection.refreshProfile(refreshed)
    }
    return profiles
  })

  handle('servers:remove', (id: string): ServerProfile[] => {
    const wasActive = connection.getInfo().profile?.id === id
    if (wasActive) void connection.disconnect()
    return config.removeProfile(id)
  })

  handle('servers:rename', (id: string, name: string): ServerProfile[] => {
    return config.renameProfile(id, name)
  })

  handle('servers:probe', (input: ServerProfileInput): Promise<ProbeResult> =>
    connection.probe(input)
  )

  handle('servers:connect', (id: string): Promise<ConnectionInfo> => connection.connect(id))

  handle('servers:disconnect', async (): Promise<void> => {
    await connection.disconnect()
  })

  /* ----------------------------------------------------------------- api */

  handle('api:request', async (method: ApiMethod, params?: unknown[]): Promise<unknown> => {
    if (!isApiMethod(method)) throw new Error(`Unknown API method: ${String(method)}`)
    if (MUTATING_METHODS.has(method)) return enqueueWrite(() => connection.request(method, params))
    return connection.request(method, params)
  })

  /* ------------------------------------------------------------ settings */

  handle('settings:get', (): AppSettings => config.getSettings())

  handle('settings:patch', (patch: Partial<AppSettings>): AppSettings => {
    return config.patchSettings(patch)
  })

  handle('settings:reset', (): AppSettings => config.resetSettings())

  /* -------------------------------------------------------------- window */

  handle('window:minimize', (): void => {
    getMainWindow()?.minimize()
  })

  handle('window:toggleMaximize', (): void => {
    const window = getMainWindow()
    if (!window) return
    if (window.isMaximized()) window.unmaximize()
    else window.maximize()
  })

  handle('window:close', (): void => {
    getMainWindow()?.close()
  })

  handle('window:setFullScreen', (value: boolean): void => {
    const window = getMainWindow()
    if (!window) return
    window.setFullScreen(value)
  })

  /* ------------------------------------------------------------- updates */

  handle('app:checkForUpdates', (manual: boolean): void => {
    checkForUpdates(manual === true)
  })

  handle('app:installUpdate', (): void => {
    quitAndInstall()
  })

  handle('app:updatesAvailable', (): boolean => isUpdaterAvailable())
}

/* ---------------------------------------------------------------- lifecycle */

function startMinimizedIfConfigured(): void {
  if (!config.getSettings().startMinimized) return
  // `window.ts` reads this flag when the window is ready to show.
  if (!process.argv.includes('--start-minimized')) process.argv.push('--start-minimized')
}

async function bootstrap(): Promise<void> {
  config.init()
  registerMediaProtocol()
  registerIpcHandlers()
  installMenuActions()
  startMinimizedIfConfigured()

  // Mirror every updater transition to the renderer so it can toast progress.
  onUpdateState((state) => sendToRenderer('update:state', state))
  wireUpdater()
  // Not manual, so the user's opt-out in Settings is honoured.
  checkForUpdates(false)

  createMainWindow()

  // Reconnect after the window exists so the renderer is already subscribed to
  // `connection:changed` and sees the transition instead of booting stale.
  void connection.restore()
}

// A second instance would fight over the single config file and the media
// protocol handlers; hand the launch back to the running window instead.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const window = getMainWindow()
    if (!window) return
    if (window.isMinimized()) window.restore()
    window.focus()
  })

  // Must happen before `app.whenReady()`: the scheme has to be privileged
  // before the protocol handler can claim it.
  registerMediaScheme()

  void app.whenReady().then(bootstrap)

  app.on('activate', () => {
    // macOS keeps the process alive with no windows; clicking the dock icon
    // must bring the app back.
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })

  app.on('window-all-closed', () => {
    // Quitting on every platform except macOS is the platform convention.
    if (process.platform !== 'darwin') app.quit()
  })

  // The config store debounces writes, so the last few mutations only exist in
  // memory until they are flushed here.
  app.on('before-quit', () => {
    config.saveNow()
  })
}
