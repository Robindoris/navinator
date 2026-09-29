import type { NavinatorBridge } from '@shared/ipc'
import type { ApiMethod } from '@shared/api-methods'

declare global {
  interface Window {
    navinator: NavinatorBridge
  }
}

/**
 * Accessor for the preload bridge.
 *
 * Throws a descriptive error rather than returning `undefined` so a missing
 * preload (the usual cause is running the renderer outside Electron) fails
 * loudly at the point of use instead of surfacing as `undefined is not a
 * function` somewhere far away.
 */
export const bridge: NavinatorBridge = new Proxy({} as NavinatorBridge, {
  get(_target, property: string | symbol) {
    const value = (window.navinator as unknown as Record<string | symbol, unknown> | undefined)?.[
      property
    ]
    if (value === undefined) {
      throw new Error(
        `The Navinator bridge is unavailable (window.navinator.${String(property)}). ` +
          'Are you running the renderer outside Electron?'
      )
    }
    return value
  }
})

/** Unwraps the `ipcRenderer.invoke` rejection into a real `Error`. */
function rethrow(error: unknown): never {
  // Electron serialises thrown errors across IPC as `Error: message`.
  if (error instanceof Error) throw error
  const message = typeof error === 'string' ? error.replace(/^Error:\s*/, '') : JSON.stringify(error)
  throw new Error(message || 'The request failed')
}

export async function call<T>(method: ApiMethod, params?: unknown[]): Promise<T> {
  try {
    return (await bridge.api.request<T>(method, params)) as T
  } catch (error) {
    rethrow(error)
  }
}
