import { create } from 'zustand'
import type { AppSettings } from '@shared/types'
import type { DeepPartial } from '@shared/ipc'
import { DEFAULT_SETTINGS } from '@shared/types'
import { bridge } from '../lib/bridge'

interface SettingsState {
  settings: AppSettings
  loaded: boolean
  load: () => Promise<void>
  patch: (patch: DeepPartial<AppSettings>) => Promise<void>
  reset: () => Promise<void>
}

export const useSettings = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,

  load: async () => {
    try {
      const settings = await bridge.settings.get()
      set({ settings, loaded: true })
    } catch {
      set({ loaded: true })
    }
  },

  /**
   * Optimistic: apply locally first so the UI (volume slider, theme) reacts on
   * the same frame as the click, then let the main process persist it.
   */
  patch: async (patch) => {
    const previous = get().settings
    const next: AppSettings = {
      ...previous,
      ...patch,
      audio: { ...previous.audio, ...(patch.audio ?? {}) }
    }
    set({ settings: next })
    try {
      const saved = await bridge.settings.patch(patch)
      set({ settings: saved })
    } catch {
      set({ settings: previous })
    }
  },

  reset: async () => {
    try {
      set({ settings: await bridge.settings.reset() })
    } catch {
      set({ settings: DEFAULT_SETTINGS })
    }
  }
}))

/** Subscribe a component to one slice of settings. */
export const selectAudio = (state: SettingsState) => state.settings.audio
export const selectTheme = (state: SettingsState) => state.settings.theme
