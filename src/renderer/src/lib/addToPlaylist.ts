/**
 * The "add to playlist" request channel.
 *
 * Kept in its own module because it is imported by both `AddToPlaylistDialog`
 * (which owns the single mounted host) and `features/shared/hooks` (which
 * supplies the stable `TrackRow` callbacks). Defining it in either of those
 * files creates an import cycle, and this repo has already been bitten by one
 * — `router.tsx` needs `lazyRouteComponent` purely to break a cycle.
 *
 * Mirrors the existing `navinator:focus-search` window-event pattern: a plain
 * `CustomEvent`, so the trigger and the host stay decoupled.
 */
export const ADD_TO_PLAYLIST_EVENT = 'navinator:add-to-playlist'

/** Asks the mounted `AddToPlaylistHost` to open for these song ids. */
export function requestAddToPlaylist(songIds: string[]): void {
  if (songIds.length === 0) return
  window.dispatchEvent(new CustomEvent<string[]>(ADD_TO_PLAYLIST_EVENT, { detail: songIds }))
}
