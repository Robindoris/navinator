import { BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { NAVIGATOR_SCHEME } from '@shared/media'

const MIN_WIDTH = 900
const MIN_HEIGHT = 600

/**
 * `electron-vite` defines `ELECTRON_RENDERER_URL` in dev and omits it in a
 * packaged build, which is all the signal we need to choose the load target.
 */
const devServerUrl = process.env['ELECTRON_RENDERER_URL']
const isDev = Boolean(devServerUrl)

/** Where the app document lives. Served by the main process, never `file://`. */
const APP_HOST = 'app'
const APP_URL = `${NAVIGATOR_SCHEME}://${APP_HOST}/index.html`

function rendererTarget(): { url?: string; file?: string } {
  if (!isDev) return { file: APP_URL }
  return { url: devServerUrl }
}

let mainWindow: BrowserWindow | null = null

export function createMainWindow(): BrowserWindow {
  const target = rendererTarget()

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    autoHideMenuBar: !isDev,
    backgroundColor: '#0b0b0f',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: process.platform === 'darwin' ? { x: 16, y: 18 } : undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      // The renderer handles no Node access at all: every privileged operation
      // goes through the narrow preload bridge.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // Media keys are delivered to the page, and the audio element is
      // controlled from the renderer, so background throttling must be off.
      backgroundThrottling: false,
      spellcheck: false
    }
  })

  // Avoid the white flash before the first paint.
  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) return
    mainWindow.show()
    if (process.argv.includes('--start-minimized')) mainWindow.minimize()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // External links open in the user's browser, never inside the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    // In production the app is a single page served from our own protocol;
    // block anything that would take it off `navinator://app`.
    if (isDev && devServerUrl && url.startsWith(devServerUrl)) return
    if (!isDev && url.startsWith(`${NAVIGATOR_SCHEME}://${APP_HOST}/`)) return
    event.preventDefault()
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
  })

  // Surface renderer failures in the terminal; they are otherwise invisible
  // once the window is up.
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (level >= 2) console.error(`[renderer] ${message} (${sourceId}:${line})`)
  })

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error(`[renderer] process gone: ${details.reason}`)
  })

  mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error(`[preload] failed to load ${preloadPath}:`, error)
  })

  if (target.url) void mainWindow.loadURL(target.url)
  else void mainWindow.loadURL(target.file!)

  return mainWindow
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}
