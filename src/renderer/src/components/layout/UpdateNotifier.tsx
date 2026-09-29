import { useEffect } from 'react'
import { toast } from 'sonner'
import { bridge } from '../../lib/bridge'
import { useUpdates } from '../../store/updates'

/**
 * Toasts for application updates.
 *
 * Mounted once, in `App`. The updater itself lives in the main process — it is
 * the only place that can read electron-builder's `app-update.yml` — and pushes
 * its state into `store/updates`; this is purely the renderer for that.
 */
export function UpdateNotifier() {
  const state = useUpdates((s) => s.state)

  useEffect(() => {
    switch (state.kind) {
      case 'available':
        toast(`Navinator ${state.version} is available`, {
          description: 'Downloading in the background…'
        })
        break
      case 'downloaded':
        // The one moment worth interrupting for: restarting is the user's call.
        toast(`Navinator ${state.version} is ready to install`, {
          description: 'Click to restart and update.',
          duration: Infinity,
          action: {
            label: 'Restart',
            onClick: () => void bridge.app.installUpdate()
          }
        })
        break
      case 'error':
        // Only surface a failure the user asked about. A background check on a
        // repo with no published release answers 406 every single time, and a
        // toast for that on every launch would be indefensible noise.
        if (state.manual) {
          toast.error('Could not check for updates', { description: state.message })
        } else {
          console.warn('[updates] background check failed:', state.message)
        }
        break
      default:
        break
    }
  }, [state])

  return null
}
