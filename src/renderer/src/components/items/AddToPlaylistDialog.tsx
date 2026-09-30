import { useEffect, useState } from 'react'
import { ListPlus, Plus } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useServerId } from '../../store/server'
import { queryKeys } from '../../lib/query-keys'
import { createPlaylist, updatePlaylist } from '../../lib/api'
import { usePlaylistsQuery } from '../../features/shared/hooks'
import { ADD_TO_PLAYLIST_EVENT } from '../../lib/addToPlaylist'
import { Dialog, DialogContent } from '../ui/overlays'
import { Button, Input, Spinner, Field } from '../ui/primitives'



/**
 * Opens the "add to playlist" sheet for the given tracks.
 *
 * `TrackRow` is a leaf component rendered in six different lists, and threading
 * a dialog through each of them would mean six copies of the same state. A
 * window event keeps the row dumb and lets one dialog instance live in
 * `AppShell`, matching how `navinator:focus-search` already works.
 */
export { requestAddToPlaylist, ADD_TO_PLAYLIST_EVENT } from '../../lib/addToPlaylist'

/** Mounts exactly one `AddToPlaylistDialog` and connects it to the event. */
export function AddToPlaylistHost() {
  const [songIds, setSongIds] = useState<string[] | null>(null)

  useEffect(() => {
    const onRequest = (event: Event): void => {
      setSongIds((event as CustomEvent<string[]>).detail ?? [])
    }
    window.addEventListener(ADD_TO_PLAYLIST_EVENT, onRequest)
    return () => window.removeEventListener(ADD_TO_PLAYLIST_EVENT, onRequest)
  }, [])

  if (!songIds) return null
  return (
    <AddToPlaylistDialog
      open
      songIds={songIds}
      onOpenChange={(open) => {
        if (!open) setSongIds(null)
      }}
    />
  )
}

/**
 * "Add to playlist" sheet.
 *
 * Opened from a track row's overflow menu. It offers every playlist plus a
 * "New playlist" field, because the common case is saving a track that does
 * not belong in anything yet.
 *
 * The same dialog creates a playlist pre-seeded with the tracks, which is why
 * it takes ids rather than a single song.
 */
export function AddToPlaylistDialog({
  open,
  onOpenChange,
  songIds
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  songIds: string[]
}) {
  const serverId = useServerId()
  const queryClient = useQueryClient()
  const [newName, setNewName] = useState('')
  const { data: playlists, isLoading } = usePlaylistsQuery()
  const count = songIds.length

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.playlists(serverId!) })

  const addExisting = useMutation({
    mutationFn: (playlistId: string) => updatePlaylist({ playlistId, songIdsToAdd: songIds }),
    onSuccess: async (playlist) => {
      await invalidate()
      toast.success(`Added to “${playlist?.name ?? 'playlist'}”`)
      onOpenChange(false)
    },
    onError: (error) => toast.error((error as Error).message)
  })

  const createAndAdd = useMutation({
    mutationFn: () => createPlaylist({ name: newName.trim(), songIds }),
    onSuccess: async (created) => {
      await invalidate()
      toast.success(
        `Created “${created?.name ?? newName.trim()}” with ${count} ${count === 1 ? 'track' : 'tracks'}`
      )
      setNewName('')
      onOpenChange(false)
    },
    onError: (error) => toast.error((error as Error).message)
  })

  const busy = addExisting.isPending || createAndAdd.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={count === 1 ? 'Add to playlist' : `Add ${count} tracks to playlist`}
        description={count === 1 ? undefined : 'They are appended to the end of the playlist.'}
        className="w-[min(26rem,calc(100vw-2rem))]"
      >
        <div className="space-y-4">
          {isLoading ? (
            <div className="grid place-items-center py-6">
              <Spinner className="size-5" />
            </div>
          ) : playlists && playlists.length > 0 ? (
            <ul className="max-h-64 space-y-0.5 overflow-y-auto">
              {playlists.map((playlist) => (
                <li key={playlist.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => addExisting.mutate(playlist.id)}
                    className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-fg transition-colors hover:bg-surface-2 disabled:opacity-50"
                  >
                    <ListPlus className="size-4 shrink-0 opacity-60" />
                    <span className="min-w-0 flex-1 truncate">{playlist.name}</span>
                    {playlist.songCount ? (
                      <span className="shrink-0 text-xs text-faint">{playlist.songCount}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">You have no playlists yet. Create one below.</p>
          )}

          <div className="space-y-2 border-t border-line pt-4">
            <Field label="New playlist" htmlFor="add-to-new-playlist">
              <div className="flex gap-2">
                <Input
                  id="add-to-new-playlist"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && newName.trim()) createAndAdd.mutate()
                  }}
                  placeholder="Playlist name"
                />
                <Button
                  variant="secondary"
                  onClick={() => createAndAdd.mutate()}
                  disabled={!newName.trim() || busy}
                  loading={createAndAdd.isPending}
                >
                  <Plus className="size-4" />
                  Create
                </Button>
              </div>
            </Field>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
