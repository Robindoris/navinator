import type { ReactNode } from 'react'
import type { Album } from '@shared/types'
import { AlbumCard } from '../../components/items/Cards'
import { Skeleton } from '../../components/ui/primitives'
import { cn } from '../../lib/utils'

export function PageHeader({
  title,
  subtitle,
  actions,
  className
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-semibold tracking-tight text-fg">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Section({
  title,
  action,
  children,
  className
}: {
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-tight text-fg">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function AlbumGrid({
  albums,
  onOpen,
  onPlay,
  loading,
  emptyMessage = 'Nothing here yet.',
  className
}: {
  albums: Album[]
  onOpen: (album: Album) => void
  onPlay: (album: Album) => void
  loading?: boolean
  emptyMessage?: string
  className?: string
}) {
  if (loading) return <AlbumGridSkeleton />

  if (albums.length === 0) {
    return (
      <p className="rounded-app border border-dashed border-line px-4 py-12 text-center text-sm text-muted">
        {emptyMessage}
      </p>
    )
  }

  return (
    <div
      className={cn(
        'grid gap-1',
        'grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]',
        className
      )}
    >
      {albums.map((album) => (
        <AlbumCard key={album.id} album={album} onOpen={onOpen} onPlay={onPlay} />
      ))}
    </div>
  )
}

export function AlbumGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-1">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="space-y-2 p-2">
          <Skeleton className="aspect-square w-full rounded-lg" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-2.5 w-1/2" />
        </div>
      ))}
    </div>
  )
}
