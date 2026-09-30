import { useNavigate } from '@tanstack/react-router'
import { Shuffle, Disc3, Radio, Sparkles, Loader2 } from 'lucide-react'
import { useAlbumListQuery, useLibraryNavigation, usePlayAlbum, useShuffleLibrary } from '../shared/hooks'
import { AlbumGrid, PageHeader, Section } from '../shared/Page'
import { Button, ErrorState, Skeleton } from '../../components/ui/primitives'
import { MediaRow } from '../../components/items/Cards'
import { useServer } from '../../store/server'
import { formatCount } from '../../lib/utils'
import { useState } from 'react'

export function HomePage() {
  const navigate = useNavigate()
  const { album } = useLibraryNavigation()
  const playAlbum = usePlayAlbum()
  const profile = useServer((s) => s.connection.profile)

  const recent = useAlbumListQuery('newest')
  const frequent = useAlbumListQuery('frequent')
  const random = useAlbumListQuery('random')

  const shuffle = useShuffleLibrary((recent.data ?? []).map((item) => item.id))
  const [shuffling, setShuffling] = useState(false)

  const runShuffle = async () => {
    setShuffling(true)
    try {
      await shuffle()
    } finally {
      setShuffling(false)
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={profile ? `Welcome back, ${profile.username}` : 'Home'}
        subtitle="Pick up where you left off, or start something new."
        actions={
          <>
            <Button variant="ghost" onClick={() => navigate({ to: '/albums', search: { view: 'newest' } })}>
              <Disc3 className="size-4" />
              Browse albums
            </Button>
            <Button
              variant="primary"
              onClick={() => void runShuffle()}
              loading={shuffling}
              disabled={!recent.data?.length}
            >
              {shuffling ? <Loader2 className="size-4 animate-spin" /> : <Shuffle className="size-4" />}
              Shuffle recently added
            </Button>
          </>
        }
      />

      {recent.error && <ErrorState message={(recent.error as Error).message} onRetry={() => recent.refetch()} />}

      <Section
        title="Recently added"
        action={
          <Button size="sm" variant="ghost" onClick={() => navigate({ to: '/albums', search: { view: 'newest' } })}>
            See all
          </Button>
        }
      >
        {recent.isLoading ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-1">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="space-y-2 p-2">
                <Skeleton className="aspect-square w-full rounded-lg" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            ))}
          </div>
        ) : (
          <AlbumGrid
            albums={recent.data ?? []}
            onOpen={(item) => album(item.id)}
            onPlay={(item) => void playAlbum(item.id, item)}
            emptyMessage="No albums have been added yet."
          />
        )}
      </Section>

      <Section title="On repeat">
        <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
          {(frequent.data ?? []).slice(0, 6).map((item) => (
            <MediaRow
              key={item.id}
              coverArt={item.coverArt}
              title={item.name}
              description={[item.artist, item.playCount ? formatCount(item.playCount, 'play') : '']
                .filter(Boolean)
                .join(' · ')}
              onClick={() => album(item.id)}
              onPlay={() => void playAlbum(item.id, item)}
            />
          ))}
          {frequent.isLoading &&
            Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="flex items-center gap-3 rounded-lg p-2">
                <Skeleton className="size-11 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-2.5 w-1/3" />
                </div>
              </div>
            ))}
        </div>
      </Section>

      <Section title="Jump into">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <JumpTile
            label="All albums"
            icon={Disc3}
            onClick={() => navigate({ to: '/albums', search: { view: 'newest' } })}
          />
          <JumpTile label="Artists" icon={Sparkles} onClick={() => navigate({ to: '/artists' })} />
          <JumpTile
            label="Random picks"
            icon={Radio}
            count={random.data?.length}
            onClick={() => navigate({ to: '/albums', search: { view: 'random' } })}
          />
          <JumpTile label="Radio stations" icon={Radio} onClick={() => navigate({ to: '/radio' })} />
        </div>
      </Section>
    </div>
  )
}

function JumpTile({
  label,
  icon: Icon,
  count,
  onClick
}: {
  label: string
  icon: React.ComponentType<{ className?: string }>
  count?: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col gap-2 rounded-app border border-line bg-surface p-4 text-left transition-colors hover:border-accent/40 hover:bg-surface-2"
    >
      <Icon className="size-5 text-accent-strong" />
      <span className="text-sm font-medium text-fg">{label}</span>
      {count ? <span className="text-xs text-faint">{formatCount(count, 'album')}</span> : null}
    </button>
  )
}
