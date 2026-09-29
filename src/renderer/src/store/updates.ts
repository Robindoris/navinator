import { create } from 'zustand'
import type { UpdateState } from '@shared/types'
import { bridge } from '../lib/bridge'

interface UpdatesState {
  state: UpdateState
  /** Asks the main process to check now, ignoring the automatic-check opt-out. */
  check: () => void
}

/**
 * Application update state.
 *
 * Deliberately a store rather than a hook per component: the main process
 * pushes `update:state` over a single IPC channel, so a hook used from both
 * `App` and `SettingsPage` would attach two listeners and toast the same
 * download twice. `initUpdateListener` attaches exactly one, once.
 */
export const useUpdates = create<UpdatesState>(() => ({
  state: { kind: 'idle' },
  check: () => void bridge.app.checkForUpdates(true)
}))

let listening = false

/** Idempotent: safe to call from anywhere, attaches at most one listener. */
export function initUpdateListener(): void {
  if (listening) return
  listening = true
  bridge.on.updateState((state) => useUpdates.setState({ state }))
}
