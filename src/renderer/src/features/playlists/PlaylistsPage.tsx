import { useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Play, Shuffle, Plus, ListMusic, MoreHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import type { Playlist, Song } from '@shared/types'
import { downloadMediaUrl } from '@shared/media'
import { changePlaylistOrder, createPlaylist, deletePlaylist, updatePlaylist } from '../../lib/api'
import { queryKeys } from '../../lib/query-keys'
import { useServerId } from '../../store/server'
import {
  useLibraryNavigation,
  usePlayPlaylist,
  usePlaySongs,
  usePlaylistsQuery,
  usePlaylistQuery,
  useTrackAnnotations,
  useTrackRowActions
} from '../shared/hooks'
import { PageHeader } from '../shared/Page'
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  Input,
  Skeleton,
  Textarea,
  Badge
} from '../../components/ui/primitives'
import {
  Dialog,
  DialogContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '../../components/ui/overlays'
import { PlaylistCard } from '../../components/items/Cards'
import { TrackRow, TrackHeader } from '../../components/items/TrackRow'
import { CoverArt } from '../../components/items/CoverArt'
import { usePlayer } from '../../store/player'
import { cn, formatCount, formatTotalDuration } from '../../lib/utils'

/* ------------------------------------------------------------------ list */

export function PlaylistsPage() {
  const { data: playlists, isLoading, error, refetch } = usePlaylistsQuery()
  const { playlist } = useLibraryNavigation()
  const playPlaylist = usePlayPlaylist()
  const [creating, setCreating] = useState(false)

  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />

  return (
    <div className="space-y-6">
      <PageHeader
        title="Playlists"
        subtitle={playlists ? formatCount(playlists.length, 'playlist') : undefined}
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            New playlist
          </Button>
        }
      />

      <CreatePlaylistDialog open={creating} onOpenChange={setCreating} />

      {isLoading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-1">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="aspect-square rounded-lg" />
          ))}
        </div>
      ) : (playlists?.length ?? 0) === 0 ? (
        <EmptyState
          icon={ListMusic}
          title="No playlists yet"
          description="Create one here, or build it from any album, artist or genre."
          action={
            <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
              Create a playlist
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-1">
          {(playlists ?? []).map((item: Playlist) => (
            <PlaylistCard
              key={item.id}
              playlist={item}
              onOpen={(value) => playlist(value.id)}
              onPlay={(value) =>
                void playPlaylist(value.id).catch((error: Error) => toast.error(error.message))
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CreatePlaylistDialog({
  open,
  onOpenChange,
  initialSongIds
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialSongIds?: string[]
}) {
  const queryClient = useQueryClient()
  const serverId = useServerId()
  const [name, setName] = useState('')
  const [comment, setComment] = useState('')
  const [isPublic, setIsPublic] = useState(false)

  const mutation = useMutation({
    // `comment` and `public` used to be collected in the form but never sent,
    // so both fields silently did nothing.
    mutationFn: () =>
      createPlaylist({
        name: name.trim(),
        comment: comment.trim() || undefined,
        public: isPublic || undefined,
        songIds: initialSongIds ?? []
      }),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.playlists(serverId!) })
      toast.success(`Created “${created?.name ?? name}”`)
      setName('')
      setComment('')
      onOpenChange(false)
    },
    onError: (error) => toast.error((error as Error).message)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="New playlist"
        description="Give it a name. You can add tracks straight afterwards."
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => mutation.mutate()}
              disabled={!name.trim() || mutation.isPending}
              loading={mutation.isPending}
            >
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          <Field label="Name" htmlFor="playlist-name">
            <Input
              id="playlist-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && name.trim()) mutation.mutate()
              }}
              placeholder="Late night listening"
              autoFocus
            />
          </Field>
          <Field label="Description" htmlFor="playlist-comment" hint="Optional">
            <Textarea
              id="playlist-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="What is this for?"
            />
          </Field>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-fg">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(event) => setIsPublic(event.target.checked)}
              className="size-4 accent-[var(--nav-accent)]"
            />
            Share publicly
          </label>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ---------------------------------------------------------------- detail */

export function PlaylistPage() {
  const { playlistId } = useParams({ from: '/playlist/$playlistId' })
  const serverId = useServerId()
  const queryClient = useQueryClient()
  const { data, isLoading, error, refetch } = usePlaylistQuery(playlistId)
  const playSongs = usePlaySongs()
  const toggleShuffle = usePlayer((s) => s.toggleShuffle)
  const shuffle = usePlayer((s) => s.shuffle)
  const addToQueue = usePlayer((s) => s.addToQueue)
  const { onStar, onRate } = useTrackAnnotations()
  const trackActions = useTrackRowActions()

  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState('')
  const [comment, setComment] = useState('')
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.playlists(serverId!) })

  /**
   * Persists a reorder.
   *
   * Subsonic's `changePlaylistOrder` replaces the whole ordering, so the new id
   * list is built from the copy already in hand. The server response is not
   * trusted to echo the order back, so the list is refetched afterwards.
   */
  const reorder = useMutation({
    mutationFn: ({ from, to }: { from: number; to: number }) => {
      const ids = (data?.entry ?? []).map((song) => song.id)
      const [moved] = ids.splice(from, 1)
      ids.splice(to, 0, moved)
      return changePlaylistOrder(playlistId, ids)
    },
    onMutate: () => {
      // Optimistic: the row visibly moves before the round trip finishes.
      setDragFrom(null)
      setDragOver(null)
    },
    onSuccess: async () => {
      await invalidate()
      await refetch()
    },
    onError: async (error) => {
      await refetch()
      toast.error((error as Error).message)
    }
  })

  const removeTracks = useMutation({
    mutationFn: (indexes: number[]) =>
      updatePlaylist({ playlistId, songIndexesToRemove: indexes }),
    onSuccess: async () => {
      await invalidate()
      await refetch()
      toast.success('Removed from playlist')
    },
    onError: (error) => toast.error((error as Error).message)
  })

  const removePlaylist = useMutation({
    mutationFn: () => deletePlaylist(playlistId),
    onSuccess: async () => {
      await invalidate()
      toast.success('Playlist deleted')
    },
    onError: (error) => toast.error((error as Error).message)
  })

  const saveEdits = useMutation({
    mutationFn: () => updatePlaylist({ playlistId, name: name.trim(), comment }),
    onSuccess: async () => {
      await refetch()
      setRenaming(false)
      toast.success('Saved')
    },
    onError: (error) => toast.error((error as Error).message)
  })

  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="size-40 rounded-xl" />
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-11 w-full" />
        ))}
      </div>
    )
  }

  const songs: Song[] = data.entry ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6 sm:flex-row">
        <CoverArt
          id={data.coverArt}
          size={400}
          alt={data.name}
          rounded="rounded-xl"
          className="size-40 shrink-0 shadow-[var(--nav-shadow)]"
          eager
        />
        <div className="min-w-0 flex-1 space-y-4">
          {renaming ? (
            <div className="space-y-3">
              <Field label="Name" htmlFor="edit-name">
                <Input id="edit-name" value={name} onChange={(event) => setName(event.target.value)} autoFocus />
              </Field>
              <Field label="Description" htmlFor="edit-comment">
                <Textarea id="edit-comment" value={comment} onChange={(event) => setComment(event.target.value)} />
              </Field>
              <div className="flex gap-2">
                <Button variant="primary" size="sm" onClick={() => saveEdits.mutate()} loading={saveEdits.isPending}>
                  Save
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setRenaming(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-faint">
                  Playlist
                  {data.public && <Badge>Public</Badge>}
                </div>
                <h1 className="text-3xl font-semibold leading-tight tracking-tight text-fg">{data.name}</h1>
                {data.comment && <p className="max-w-xl text-sm text-muted">{data.comment}</p>}
                <div className="flex items-center gap-2 text-xs text-faint">
                  {data.owner && <span>{data.owner}</span>}
                  <span aria-hidden>·</span>
                  <span>{formatCount(songs.length, 'track')}</span>
                  {data.duration ? (
                    <>
                      <span aria-hidden>·</span>
                      <span>{formatTotalDuration(data.duration)}</span>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button variant="primary" size="lg" onClick={() => playSongs(songs, 0)} disabled={songs.length === 0}>
                  <Play className="size-4 fill-current" />
                  Play
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  disabled={songs.length === 0}
                  onClick={() => {
                    if (!shuffle) toggleShuffle()
                    playSongs([...songs].sort(() => Math.random() - 0.5), 0)
                  }}
                >
                  <Shuffle className="size-4" />
                  Shuffle
                </Button>
                <Button
                  variant="ghost"
                  disabled={songs.length === 0}
                  onClick={() => addToQueue(songs)}
                >
                  Queue
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <IconButton label="Playlist options" size="icon" variant="secondary">
                      <MoreHorizontal className="size-4" />
                    </IconButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem
                      onSelect={() => {
                        setName(data.name)
                        setComment(data.comment ?? '')
                        setRenaming(true)
                      }}
                    >
                      Edit details
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      danger
                      disabled={removePlaylist.isPending}
                      onSelect={() => removePlaylist.mutate()}
                    >
                      Delete playlist
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </>
          )}
        </div>
      </div>

      {songs.length === 0 ? (
        <EmptyState icon={ListMusic} title="This playlist is empty" description="Add tracks from any album or genre." />
      ) : (
        <div className="space-y-1">
          <TrackHeader />
          {songs.map((song, index) => (
            <div
              key={`${song.id}-${index}`}
              draggable
              onDragStart={() => setDragFrom(index)}
              onDragOver={(event) => {
                event.preventDefault()
                if (dragOver !== index) setDragOver(index)
              }}
              onDrop={(event) => {
                event.preventDefault()
                if (dragFrom !== null && dragFrom !== index) reorder.mutate({ from: dragFrom, to: index })
                setDragFrom(null)
                setDragOver(null)
              }}
              onDragEnd={() => {
                setDragFrom(null)
                setDragOver(null)
              }}
              className={cn(
                'rounded-md transition-shadow',
                dragOver === index && dragFrom !== index && 'ring-1 ring-accent',
                dragFrom === index && 'opacity-50'
              )}
            >
              <TrackRow
                song={song}
                index={index}
                showAlbum
                album={{ name: song.album, coverArt: song.coverArt }}
                onPlay={(target) => playSongs(songs, target)}
                {...trackActions}
                onStar={onStar}
                onRate={onRate}
                onDownload={trackDownload}
                onRemove={() => removeTracks.mutate([index])}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Saves the original file via the main-process proxy, so no token leaks. */
function trackDownload(song: Song): void {
  const url = downloadMediaUrl(song.id)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${(song.artist ?? 'track')} - ${song.title}.${song.suffix ?? 'audio'}`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}
