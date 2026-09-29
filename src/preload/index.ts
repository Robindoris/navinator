import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { NavinatorBridge } from '@shared/ipc'

/**
 * The only channel the renderer is allowed to send arbitrary data on.
 * It is validated again in the main process against an allow-list.
 */
const API_REQUEST = 'api:request'

/**
 * Wraps a listener so the `IpcRendererEvent` — which exposes `sender` and
 * could be used to reach back into the IPC system — never reaches page code.
 */
function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const handler = (_event: IpcRendererEvent, payload: T): void => callback(payload)
  ipcRenderer.on(channel, handler)
  return () => {
    ipcRenderer.removeListener(channel, handler)
  }
}

const bridge: NavinatorBridge = {
  app: {
    info: () => ipcRenderer.invoke('app:info'),
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggleMaximize'),
    close: () => ipcRenderer.invoke('window:close'),
    setFullScreen: (value: boolean) => ipcRenderer.invoke('window:setFullScreen', value),
    checkForUpdates: (manual = false) => ipcRenderer.invoke('app:checkForUpdates', manual),
    installUpdate: () => ipcRenderer.invoke('app:installUpdate'),
    updatesAvailable: () => ipcRenderer.invoke('app:updatesAvailable')
  },
  servers: {
    list: () => ipcRenderer.invoke('servers:list'),
    save: (input) => ipcRenderer.invoke('servers:save', input),
    remove: (id) => ipcRenderer.invoke('servers:remove', id),
    rename: (id, name) => ipcRenderer.invoke('servers:rename', id, name),
    probe: (input) => ipcRenderer.invoke('servers:probe', input),
    connect: (id) => ipcRenderer.invoke('servers:connect', id),
    disconnect: () => ipcRenderer.invoke('servers:disconnect')
  },
  api: {
    request: <T>(method: string, params?: unknown[]) =>
      ipcRenderer.invoke(API_REQUEST, method, params) as Promise<T>
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    patch: (patch) => ipcRenderer.invoke('settings:patch', patch),
    reset: () => ipcRenderer.invoke('settings:reset')
  },
  on: {
    connectionChanged: (cb) => subscribe('connection:changed', cb),
    menuAction: (cb) => subscribe('menu:action', cb),
    updateState: (cb) => subscribe('update:state', cb)
  }
}

contextBridge.exposeInMainWorld('navinator', bridge)
