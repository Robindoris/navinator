import { create } from 'zustand'
import type { ConnectionInfo, ServerProfile, ServerProfileInput } from '@shared/types'
import { bridge } from '../lib/bridge'

interface ServerState {
  profiles: ServerProfile[]
  connection: ConnectionInfo
  loading: boolean

  load: () => Promise<void>
  save: (input: ServerProfileInput) => Promise<ServerProfile[]>
  remove: (id: string) => Promise<void>
  rename: (id: string, name: string) => Promise<void>
  probe: (input: ServerProfileInput) => ReturnType<typeof bridge.servers.probe>
  connect: (id: string) => Promise<ConnectionInfo>
  disconnect: () => Promise<void>
  applyConnection: (info: ConnectionInfo) => void
}

const DISCONNECTED: ConnectionInfo = {
  state: 'disconnected',
  profile: null,
  serverVersion: null,
  apiVersion: null,
  serverType: null,
  openSubsonic: false,
  extensions: [],
  error: null
}

export const useServer = create<ServerState>((set) => ({
  profiles: [],
  connection: DISCONNECTED,
  loading: true,

  load: async () => {
    set({ loading: true })
    try {
      const profiles = await bridge.servers.list()
      set({ profiles, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  save: async (input) => {
    const profiles = await bridge.servers.save(input)
    set({ profiles })
    return profiles
  },

  remove: async (id) => {
    set({ profiles: await bridge.servers.remove(id) })
  },

  rename: async (id, name) => {
    set({ profiles: await bridge.servers.rename(id, name) })
  },

  probe: (input) => bridge.servers.probe(input),

  connect: async (id) => {
    const info = await bridge.servers.connect(id)
    set({ connection: info })
    return info
  },

  disconnect: async () => {
    await bridge.servers.disconnect()
    set({ connection: DISCONNECTED })
  },

  /** Pushed from the main process whenever the connection changes. */
  applyConnection: (info) => set({ connection: info })
}))

/** The active server's id, or null — used as the root of every query key. */
export const useServerId = (): string | null => useServer((s) => s.connection.profile?.id ?? null)
export const useIsConnected = (): boolean => useServer((s) => s.connection.state === 'connected')
