import { useEffect, useState } from 'react'
import {
  Server,
  Sliders,
  Palette,
  Keyboard,
  ShieldCheck,
  RotateCcw,
  LogOut,
  Music4,
  Radio as RadioIcon
} from 'lucide-react'
import { toast } from 'sonner'
import { SHORTCUTS } from '@shared/shortcuts'
import { useSettings } from '../../store/settings'
import { useServer } from '../../store/server'
import { usePlayer } from '../../store/player'
import { useUpdates } from '../../store/updates'
import { bridge } from '../../lib/bridge'
import { PageHeader } from '../shared/Page'
import { Button, Field, Select, Badge } from '../../components/ui/primitives'
import { Segmented, Slider, Switch } from '../../components/ui/overlays'
import { ThemePicker } from '../../components/ui/ThemePicker'
import { Avatar } from '../../components/items/CoverArt'
import { cn } from '../../lib/utils'
import type { StreamFormat, ThemeMode } from '@shared/types'
import { resolveAccentTheme } from '@shared/themes'

const BITRATES = [
  { value: '0', label: 'No limit (original quality)' },
  { value: '64', label: '64 kbps — very low' },
  { value: '96', label: '96 kbps — mobile' },
  { value: '128', label: '128 kbps — MP3 standard' },
  { value: '192', label: '192 kbps — high' },
  { value: '256', label: '256 kbps — very high' },
  { value: '320', label: '320 kbps — MP3 maximum' }
]

const FORMATS: { value: StreamFormat; label: string }[] = [
  { value: 'raw', label: 'Match source' },
  { value: 'opus', label: 'Opus' },
  { value: 'mp3', label: 'MP3' },
  { value: 'aac', label: 'AAC' }
]

export function SettingsPage() {
  const { settings, patch, reset } = useSettings()
  const updateState = useUpdates((s) => s.state)
  const checkForUpdates = useUpdates((s) => s.check)
  const [version, setVersion] = useState<string | null>(null)
  const audio = settings.audio
  const { connection, profiles, disconnect, remove } = useServer()
  const clearQueue = usePlayer((s) => s.clearQueue)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    void bridge.app
      .info()
      .then((info) => setVersion(info.version))
      .catch(() => undefined)
  }, [])

  const profile = connection.profile

  return (
    <div className="max-w-3xl space-y-8">
      <PageHeader title="Settings" />

      {/* Account */}
      <Section icon={Server} title="Server">
        {profile ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-app border border-line bg-surface p-3">
              <Avatar username={profile.username} size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-fg">{profile.name}</span>
                  {profile.isAdmin && <Badge tone="accent">admin</Badge>}
                  {connection.openSubsonic && <Badge tone="success">OpenSubsonic</Badge>}
                </div>
                <div className="truncate text-xs text-muted">
                  {profile.username} · {profile.url}
                </div>
              </div>
            </div>
            {connection.serverVersion && (
              <p className="text-xs text-faint">
                {connection.serverType ?? 'Subsonic'} {connection.serverVersion} · API {connection.apiVersion}
                {connection.extensions.length > 0 &&
                  ` · ${connection.extensions.length} extensions: ${connection.extensions
                    .map((item) => item.name)
                    .join(', ')}`}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  clearQueue()
                  void disconnect()
                  toast.message('Disconnected')
                }}
              >
                <LogOut className="size-4" />
                Disconnect
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  clearQueue()
                  void remove(profile.id)
                  void disconnect()
                  toast.success('Server removed')
                }}
              >
                Remove server
              </Button>
            </div>
            {profiles.length > 1 && (
              <p className="text-xs text-faint">{profiles.length} servers saved on this device.</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">Not connected.</p>
        )}
      </Section>

      {/* Audio */}
      <Section icon={Sliders} title="Audio">
        <div className="space-y-5">
          <ToggleRow
            label="Gapless playback"
            description="Preloads the next track so albums play without a gap. Slightly higher bandwidth."
            checked={audio.gapless}
            onChange={(value) => patch({ audio: { gapless: value } })}
          />

          {audio.gapless && (
            <Field
              label={`Crossfade${audio.crossfade > 0 ? ` — ${audio.crossfade} ms` : ''}`}
              hint="Overlapping the two decks. Leave at zero for a true gapless cut."
              className="ml-11 pl-4"
            >
              <Slider
                value={[audio.crossfade]}
                max={8000}
                step={250}
                // `Field` has no `htmlFor` for a slider, so the accessible name
                // and the unit have to come from the widget itself.
                aria-label="Crossfade duration"
                aria-valuetext={`${audio.crossfade} milliseconds`}
                onValueChange={(value) => patch({ audio: { crossfade: value[0] } })}
              />
            </Field>
          )}

          <div className="space-y-1.5">
            <ToggleRow
              label="Transcode when needed"
              description="Streams original files whenever your system can play them, and only converts formats it cannot — so lossless stays lossless."
              checked={audio.transcode}
              onChange={(value) => patch({ audio: { transcode: value } })}
            />
            {audio.transcode && (
              <div className="ml-11 grid gap-3 pt-2 sm:grid-cols-2">
                <Field label="Maximum bitrate" htmlFor="bitrate">
                  <Select
                    id="bitrate"
                    value={String(audio.maxBitRate)}
                    onChange={(event) => patch({ audio: { maxBitRate: Number(event.target.value) } })}
                  >
                    {BITRATES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Preferred format" htmlFor="format">
                  <Select
                    id="format"
                    value={audio.format}
                    onChange={(event) => patch({ audio: { format: event.target.value as StreamFormat } })}
                  >
                    {FORMATS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <p className="text-[11px] leading-relaxed text-faint sm:col-span-2">
                  These only apply to files your system cannot play natively (WMA, APE, ALAC, DSD and friends).
                  Note that a transcoded stream is chunked, which can make seeking imprecise on very long tracks.
                </p>
              </div>
            )}
          </div>

          <ToggleRow
            label="Scrobble to Navidrome"
            description="Counts a track as played after half of it, or four minutes, whichever comes first. This is what updates play counts and Last.fm."
            checked={audio.scrobble}
            onChange={(value) => patch({ audio: { scrobble: value } })}
          />

          <ToggleRow
            label="Report playback state"
            description="Sends play/pause/seek heartbeats so other clients can see what you are listening to right now."
            checked={audio.playbackReport}
            onChange={(value) => patch({ audio: { playbackReport: value } })}
          />
        </div>
      </Section>

      {/* Appearance */}
      <Section icon={Palette} title="Appearance">
        <div className="space-y-5">
          <Field
            label="Colour theme"
            hint="Pick a palette. Each one has both a light and a dark variant, so it works with any mode below."
          >
            <ThemePicker
              value={resolveAccentTheme(settings.accent)}
              onChange={(value) => patch({ accent: value })}
            />
          </Field>

          <Field label="Mode">
            <Segmented<ThemeMode>
              label="Colour mode"
              value={settings.theme}
              onChange={(value) => patch({ theme: value })}
              options={[
                { value: 'dark', label: 'Dark' },
                { value: 'light', label: 'Light' },
                { value: 'system', label: 'System' }
              ]}
            />
          </Field>

          <div className="space-y-1.5 border-t border-line pt-5">
            <ToggleRow
              label="Compact album grid"
              description="Tighter spacing so more albums fit on screen."
              checked={settings.compactAlbumGrid}
              onChange={(value) => patch({ compactAlbumGrid: value })}
            />
            <ToggleRow
              label="Start minimised"
              description="Open the window minimised on launch. Applies the next time Navinator opens."
              checked={settings.startMinimized}
              onChange={(value) => patch({ startMinimized: value })}
            />
            <ToggleRow
              label="Install updates automatically"
              description="Check for a new Navinator on launch. Updates download in the background and are never installed without your say-so."
              checked={settings.autoUpdate}
              onChange={(value) => patch({ autoUpdate: value })}
            />
            <div className="flex items-center justify-between gap-4 pt-1">
              <p className="text-xs text-faint">
                {updateState.kind === 'downloading'
                  ? `Downloading… ${updateState.percent}%`
                  : updateState.kind === 'checking'
                    ? 'Checking…'
                    : updateState.kind === 'up-to-date'
                      ? `Navinator ${version ?? ''} is up to date.`
                      : 'Manual check contacts the release feed.'}
              </p>
              <Button
                variant="ghost"
                onClick={checkForUpdates}
                disabled={updateState.kind === 'checking' || updateState.kind === 'downloading'}
              >
                Check now
              </Button>
            </div>
          </div>
        </div>
      </Section>

      {/* Privacy */}
      <Section icon={ShieldCheck} title="Privacy">
        <ul className="space-y-2 text-sm text-muted">
          <li className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
            Your password is encrypted with your operating system keyring and never leaves the main process.
          </li>
          <li className="flex items-start gap-2">
            <RadioIcon className="mt-0.5 size-4 shrink-0 text-success" />
            No analytics, telemetry or crash reporting. Navinator only talks to your own server.
          </li>
          <li className="flex items-start gap-2">
            <Music4 className="mt-0.5 size-4 shrink-0 text-success" />
            Stream tokens stay in the main process — they never appear in a page URL.
          </li>
        </ul>
      </Section>

      {/* Shortcuts */}
      <Section icon={Keyboard} title="Keyboard shortcuts">
        <p className="mb-3 text-xs text-muted">
          Press <kbd className="rounded border border-line bg-surface-2 px-1 py-0.5 font-mono">?</kbd>{' '}
          anywhere in the app for this list.
        </p>
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {SHORTCUTS.map((shortcut) => (
            <div
              key={`${shortcut.group}-${shortcut.keys}-${shortcut.label}`}
              className="flex items-baseline justify-between gap-4 border-b border-line py-1.5"
            >
              <dt className="text-sm text-muted">{shortcut.label}</dt>
              <dd className="shrink-0 font-mono text-xs text-fg">{shortcut.keys}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* Reset */}
      <Section icon={RotateCcw} title="Reset">
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            loading={resetting}
            onClick={() => {
              setResetting(true)
              clearQueue()
              void reset().then(() => {
                setResetting(false)
                toast.success('Settings restored to defaults')
              })
            }}
          >
            <RotateCcw className="size-4" />
            Restore defaults
          </Button>
          <span className="text-xs text-faint">Your servers and playlists are not affected.</span>
        </div>
      </Section>
    </div>
  )
}

function Section({
  icon: Icon,
  title,
  children
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-fg">
        <Icon className="size-4 text-accent-strong" />
        {title}
      </h2>
      <div className="rounded-app border border-line bg-surface p-4">{children}</div>
    </section>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  onChange
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="min-w-0">
        <div className={cn('text-sm font-medium', checked ? 'text-fg' : 'text-muted')}>{label}</div>
        {description && <p className="mt-0.5 text-xs leading-relaxed text-faint">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} className="mt-0.5" />
    </div>
  )
}
