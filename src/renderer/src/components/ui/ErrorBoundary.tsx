import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * Catches render-time crashes so one bad component cannot white-screen the app.
 *
 * Without this, a throw anywhere below `App` unmounts the whole tree and the
 * window is left showing a blank document with no way back — for a desktop app
 * that is indistinguishable from the app having quit. React 19 removed
 * `componentDidCatch`-less boundaries being optional: this is the only thing
 * standing between a render bug and an unrecoverable window.
 *
 * Deliberately a class component: it is the only way to implement this, and it
 * owns no state worth modernising.
 */
interface Props {
  children: ReactNode
  /**
   * Changing any value here resets the boundary, so the user can retry after a
   * transient fault without reloading the window.
   */
  resetKey?: string
}

interface State {
  error: Error | null
  info: string | null
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null, info: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // React has no in-app error reporting, so the terminal is the only place a
    // user or maintainer can see the component stack.
    console.error('[renderer] uncaught error:', error, info.componentStack)
    this.setState({ info: info.componentStack ?? null })
  }

  override componentDidUpdate(prev: Props): void {
    // A new key means new content, so give it a fresh chance to render.
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null, info: null })
    }
  }

  private readonly retry = (): void => {
    this.setState({ error: null, info: null })
  }

  private readonly reload = (): void => {
    window.location.reload()
  }

  override render(): ReactNode {
    const { error, info } = this.state
    if (!error) return this.props.children

    return (
      <div className="grid h-full place-items-center bg-bg px-6 text-center">
        <div role="alert" className="max-w-lg space-y-4">
          <h1 className="text-lg font-semibold text-fg">Navinator hit an unexpected error</h1>
          <p className="text-sm text-muted">
            This is a bug, not something you did. Your library and queue are untouched — the player
            is still in the background.
          </p>
          <pre className="max-h-40 overflow-auto rounded-lg bg-surface-2 p-3 text-left text-xs text-muted">
            {error.message}
          </pre>
          {info && (
            <pre className="max-h-40 overflow-auto rounded-lg bg-surface-2 p-3 text-left text-[10px] text-faint">
              {info}
            </pre>
          )}
          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={this.retry}
              className="rounded-md bg-surface-2 px-3 py-1.5 text-sm text-fg hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={this.reload}
              className="rounded-md bg-surface-2 px-3 py-1.5 text-sm text-fg hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
            >
              Reload window
            </button>
          </div>
        </div>
      </div>
    )
  }
}
