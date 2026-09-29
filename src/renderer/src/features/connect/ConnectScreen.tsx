import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Server, Plus, Trash2, Check, Loader2, Wifi, ChevronRight } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import type { ServerProfile, ServerProfileInput } from '@shared/types'
import { useServer } from '../../store/server'
import { usePlayer } from '../../store/player'
import { bridge } from '../../lib/bridge'
import { Button, Field, Input, IconButton, Badge } from '../../components/ui/primitives'
import { cn } from '../../lib/utils'

/**
 * Server chooser and sign-in.
 *
 * Credentials are validated against the server *before* being stored, so a
 * typo is caught here rather than surfacing later as an empty library.
 */
export function ConnectScreen() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { profiles, load, save, remove, probe, connect, connection } = useServer()
  const clearQueue = usePlayer((s) => s.clearQueue)

  const [url, setUrl] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [probeNote, setProbeNote] = useState<string | null>(null)

  useEffect(() => {
    void load()
  }, [load])

  // Escape to the library as soon as a connection succeeds.
  useEffect(() => {
    if (connection.state === 'connected') navigate({ to: '/' })
  }, [connection.state, navigate])

  const connectTo = async (profile: ServerProfile) => {
    setError(null)
    setBusy(profile.id)
    const info = await connect(profile.id)
    setBusy(null)
    if (info.state === 'connected') {
      queryClient.clear()
      clearQueue()
      navigate({ to: '/' })
    } else {
      setError(info.error)
    }
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setProbeNote(null)

    const input: ServerProfileInput = { url, username, password }

    // 1. Check reachability and credentials up front.
    setBusy('probe')
    const result = await probe(input)
    setBusy(null)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setProbeNote(`Connected to ${result.serverType ?? 'Subsonic'} ${result.serverVersion ?? ''}`.trim())

    // 2. Persist, then establish the live connection.
    setBusy('save')
    const saved = await save({ ...input, name: name || undefined })
    setBusy(null)

    const match = saved.find(
      (item) => item.url === input.url.replace(/\/+$/, '') && item.username === username
    )
    if (!match) {
      setError('Could not save the server details')
      return
    }
    await connectTo(match)
  }

  const removeProfile = async (profile: ServerProfile) => {
    setError(null)
    await remove(profile.id)
  }

  return (
    <div className="grid h-full overflow-y-auto bg-bg lg:grid-cols-[1fr_28rem]">
      {/* Marketing / status pane */}
      <div className="relative hidden flex-col justify-between overflow-hidden p-10 lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-32 -top-32 size-[34rem] rounded-full opacity-[0.16] blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--nav-accent), transparent 65%)' }}
        />
        <div className="relative">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-accent text-accent-fg">
              <Server className="size-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight">Navinator</span>
          </div>
          <h1 className="mt-12 max-w-md text-3xl font-semibold leading-tight tracking-tight">
            Your music, at native speed.
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
            A fast desktop client for Navidrome and any Subsonic server. Gapless playback, offline-friendly
            artwork, and your credentials locked in the OS keyring rather than the page.
          </p>
        </div>
        <dl className="relative grid grid-cols-3 gap-4 text-xs">
          {[
            ['Lossless', 'Streams originals untouched'],
            ['Gapless', 'Two-deck playback engine'],
            ['Private', 'No telemetry, no account']
          ].map(([title, body]) => (
            <div key={title}>
              <dt className="font-medium text-fg">{title}</dt>
              <dd className="mt-0.5 text-muted">{body}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Form pane */}
      <div className="border-l border-line bg-surface p-8">
        <div className="mx-auto max-w-sm space-y-6">
          {profiles.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-faint">Your servers</h2>
              <ul className="space-y-1.5">
                {profiles.map((profile) => (
                  <li
                    key={profile.id}
                    className={cn(
                      'group flex items-center gap-2 rounded-lg border border-line bg-surface-2 p-2 transition-colors',
                      connection.profile?.id === profile.id && 'border-accent'
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => connectTo(profile)}
                      disabled={busy !== null}
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left disabled:opacity-60"
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-3">
                        {busy === profile.id ? (
                          <Loader2 className="size-4 animate-spin text-accent" />
                        ) : (
                          <Server className="size-4 text-muted" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-fg">{profile.name}</span>
                        <span className="block truncate text-[11px] text-muted">
                          {profile.username} · {profile.url.replace(/^https?:\/\//, '')}
                        </span>
                      </span>
                      {profile.isAdmin && <Badge tone="accent">admin</Badge>}
                    </button>
                    <IconButton
                      label={`Remove ${profile.name}`}
                      size="icon-xs"
                      variant="ghost"
                      className="opacity-0 group-hover:opacity-100"
                      onClick={() => removeProfile(profile)}
                    >
                      <Trash2 className="size-3.5" />
                    </IconButton>
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-2 pt-1 text-[11px] text-faint">
                <Check className="size-3" />
                Passwords are encrypted with your operating system keyring.
              </div>
            </section>
          )}

          <form onSubmit={submit} className="space-y-3.5">
            <div>
              <h2 className="text-base font-semibold">
                {profiles.length > 0 ? 'Add another server' : 'Connect to your server'}
              </h2>
              <p className="mt-0.5 text-xs text-muted">
                Usually the address your Navidrome web interface is served from.
              </p>
            </div>

            <Field label="Server address" htmlFor="url" hint="For example music.example.com or http://nas.local:4533">
              <Input
                id="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="music.example.com"
                autoComplete="url"
                required
              />
            </Field>

            <Field label="Username" htmlFor="username">
              <Input
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                required
              />
            </Field>

            <Field label="Password" htmlFor="password">
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
              />
            </Field>

            <Field label="Name this server" htmlFor="name" hint="Optional — handy if you run more than one.">
              <Input id="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Home" />
            </Field>

            {error && (
              <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                {error}
              </div>
            )}
            {probeNote && !error && (
              <div className="flex items-center gap-1.5 text-xs text-success">
                <Wifi className="size-3.5" />
                {probeNote}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              loading={busy !== null}
            >
              {busy === 'probe' || busy === 'save' ? 'Checking…' : 'Connect'}
              <ChevronRight className="size-4" />
            </Button>

            {profiles.length === 0 && (
              <p className="flex items-center justify-center gap-1.5 text-[11px] text-faint">
                <Plus className="size-3" />
                Your library stays on your own server.
              </p>
            )}
          </form>

          <EncryptionNotice />
        </div>
      </div>
    </div>
  )
}

function EncryptionNotice() {
  const [available, setAvailable] = useState<boolean | null>(null)
  useEffect(() => {
    void bridge.app
      .info()
      .then((info) => setAvailable(info.encryptionAvailable))
      .catch(() => setAvailable(false))
  }, [])

  if (available === false) {
    return (
      <p className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-[11px] leading-relaxed text-muted">
        No system keyring was detected, so the password will be stored obfuscated rather than encrypted. On
        Linux, install <code className="font-mono">gnome-keyring</code> or <code className="font-mono">kwallet</code>{' '}
        to protect it properly.
      </p>
    )
  }
  return null
}
