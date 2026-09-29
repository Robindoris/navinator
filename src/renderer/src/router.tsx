import { createHashHistory, createRootRoute, createRoute, createRouter, lazyRouteComponent } from '@tanstack/react-router'
import { NotFound } from './features/NotFound'

/**
 * Every route component is code-split, including the shell.
 *
 * `lazyRouteComponent` normally infers the component type from the dynamic
 * import, which makes this module depend on every page's types. The pages in
 * turn call `useNavigate`/`useParams`, which read the `Register` interface at
 * the bottom of this file — and that interface is `typeof router`, i.e. this
 * very module. The cycle resolves to a half-built route tree, and every
 * `navigate({ to: '/albums' })` is then rejected as an unknown path.
 *
 * `lazyPage` erases the loader's return type, which severs the loop. Runtime
 * behaviour is unchanged: components are still split out and loaded on demand.
 */
/**
 * Code-split helper that picks a specific named export from the lazily loaded
 * module. This is needed because some files export multiple page components
 * (e.g. PlaylistsPage.tsx exports both PlaylistsPage and PlaylistPage).
 */
function lazyPage(loader: () => Promise<unknown>, exportName: string) {
  return lazyRouteComponent(
    (async () => {
      const mod = (await loader()) as Record<string, unknown>
      return { default: mod[exportName] }
    }) as never,
    'default' as never
  )
}

/**
 * `App` is the root component. It renders either the connect screen or
 * `AppShell` (which owns the `<Outlet />`), so the pages hang directly off the
 * root rather than off a pathless layout route — that keeps every route id a
 * clean `/album/$albumId` instead of `/_layout/album/$albumId`.
 */
const rootRoute = createRootRoute({
  component: lazyPage(() => import('./App'), 'App')
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: lazyPage(() => import('./features/home/HomePage'), 'HomePage')
})

const albumsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/albums',
  // `?view=` drives the sorting tabs. Declared non-optional so the router
  // always knows the shape and callers pass a concrete value.
  validateSearch: (search: Record<string, unknown>): { view: AlbumView } => ({
    view: isAlbumView(search.view) ? search.view : 'newest'
  }),
  component: lazyPage(() => import('./features/library/AlbumsPage'), 'AlbumsPage')
})

const albumRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/album/$albumId',
  component: lazyPage(() => import('./features/library/AlbumPage'), 'AlbumPage')
})

const artistsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/artists',
  component: lazyPage(() => import('./features/library/ArtistsPage'), 'ArtistsPage')
})

const artistRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/artist/$artistId',
  component: lazyPage(() => import('./features/library/ArtistPage'), 'ArtistPage')
})

const genresRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/genres',
  component: lazyPage(() => import('./features/library/GenresPage'), 'GenresPage')
})

const genreRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/genre/$genre',
  component: lazyPage(() => import('./features/library/GenresPage'), 'GenrePage')
})

const playlistsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/playlists',
  component: lazyPage(() => import('./features/playlists/PlaylistsPage'), 'PlaylistsPage')
})

const playlistRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/playlist/$playlistId',
  component: lazyPage(() => import('./features/playlists/PlaylistsPage'), 'PlaylistPage')
})

const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/search',
  component: lazyPage(() => import('./features/search/SearchPage'), 'SearchPage')
})

const favouritesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/favourites',
  component: lazyPage(() => import('./features/favourites/FavouritesPage'), 'FavouritesPage')
})

const queueRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/queue',
  component: lazyPage(() => import('./features/queue/QueuePage'), 'QueuePage')
})

const radioRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/radio',
  component: lazyPage(() => import('./features/radio/RadioPage'), 'RadioPage')
})

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: lazyPage(() => import('./features/settings/SettingsPage'), 'SettingsPage')
})

const notFoundRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/$',
  component: NotFound
})

export const router = createRouter({
  routeTree: rootRoute.addChildren([
    indexRoute,
    albumsRoute,
    albumRoute,
    artistsRoute,
    artistRoute,
    genresRoute,
    genreRoute,
    playlistsRoute,
    playlistRoute,
    searchRoute,
    favouritesRoute,
    queueRoute,
    radioRoute,
    settingsRoute,
    notFoundRoute
  ]),
  // A packaged build is loaded from `file://`, where the browser History API
  // cannot rewrite paths.
  history: createHashHistory(),
  defaultPreload: 'intent'
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

/* --------------------------------------------------------- album list view */

const ALBUM_VIEWS = [
  'newest',
  'alphabeticalByName',
  'alphabeticalByArtist',
  'byYear',
  'frequent',
  'recent',
  'highest',
  'random',
  'starred'
] as const

export type AlbumView = (typeof ALBUM_VIEWS)[number]

export function isAlbumView(value: unknown): value is AlbumView {
  return typeof value === 'string' && (ALBUM_VIEWS as readonly string[]).includes(value)
}
