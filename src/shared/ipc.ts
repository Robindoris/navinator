import type { ApiMethod } from './api-methods'
import type {
  AppInfo,
  AppSettings,
  ConnectionInfo,
  MenuAction,
  ProbeResult,
  ServerProfile,
  ServerProfileInput,
  UpdateState
} from './types'

/**
 * The complete, typed IPC surface between the renderer and the main process.
 *
 * Keeping this map exhaustive means the preload bridge, the main-process
 * handlers and the renderer client can never drift apart: adding a channel
 * without wiring it up is a type error.
 */
export interface IpcInvokeMap {
  'app:info': { args: []; ret: AppInfo }

  'servers:list': { args: []; ret: ServerProfile[] }
  'servers:save': { args: [input: ServerProfileInput]; ret: ServerProfile[] }
  'servers:remove': { args: [id: string]; ret: ServerProfile[] }
  'servers:rename': { args: [id: string, name: string]; ret: ServerProfile[] }
  'servers:probe': { args: [input: ServerProfileInput]; ret: ProbeResult }
  'servers:connect': { args: [id: string]; ret: ConnectionInfo }
  'servers:disconnect': { args: []; ret: void }

  'api:request': { args: [method: ApiMethod, params?: unknown[]]; ret: unknown }

  'settings:get': { args: []; ret: AppSettings }
  'settings:patch': { args: [patch: DeepPartial<AppSettings>]; ret: AppSettings }
  'settings:reset': { args: []; ret: AppSettings }

  'window:minimize': { args: []; ret: void }
  'window:toggleMaximize': { args: []; ret: void }
  'window:close': { args: []; ret: void }
  'window:setFullScreen': { args: [value: boolean]; ret: void }

  'app:checkForUpdates': { args: [manual: boolean]; ret: void }
  'app:installUpdate': { args: []; ret: void }
  'app:updatesAvailable': { args: []; ret: boolean }
}

export type IpcChannel = keyof IpcInvokeMap

/** Push notifications sent from main to renderer. */
export interface IpcEventMap {
  'connection:changed': ConnectionInfo
  'menu:action': MenuAction
  'protocol:cover': { url: string }
  'update:state': UpdateState
}

export type IpcEvent = keyof IpcEventMap

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends readonly unknown[] ? T[K] : T[K] extends object ? DeepPartial<T[K]> : T[K]
}

/**
 * The object exposed on `window.navinator` by the preload script.
 * Mirrored by `src/preload/index.ts` and consumed by the renderer only.
 */
export interface NavinatorBridge {
  app: {
    info(): Promise<AppInfo>
    minimize(): Promise<void>
    toggleMaximize(): Promise<void>
    close(): Promise<void>
    setFullScreen(value: boolean): Promise<void>
    checkForUpdates(manual?: boolean): Promise<void>
    installUpdate(): Promise<void>
    updatesAvailable(): Promise<boolean>
  }
  servers: {
    list(): Promise<ServerProfile[]>
    save(input: ServerProfileInput): Promise<ServerProfile[]>
    remove(id: string): Promise<ServerProfile[]>
    rename(id: string, name: string): Promise<ServerProfile[]>
    probe(input: ServerProfileInput): Promise<ProbeResult>
    connect(id: string): Promise<ConnectionInfo>
    disconnect(): Promise<void>
  }
  api: {
    /** Forward a Subsonic call to the connected server. */
    request<T = unknown>(method: ApiMethod, params?: unknown[]): Promise<T>
  }
  settings: {
    get(): Promise<AppSettings>
    patch(patch: DeepPartial<AppSettings>): Promise<AppSettings>
    reset(): Promise<AppSettings>
  }
  on: {
    connectionChanged(cb: (info: ConnectionInfo) => void): () => void
    menuAction(cb: (action: MenuAction) => void): () => void
    updateState(cb: (state: UpdateState) => void): () => void
  }
}
