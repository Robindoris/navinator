import { useEffect, useState } from 'react'
import { Music } from 'lucide-react'
import { coverMediaUrl, avatarMediaUrl, placeholderCoverDataUrl } from '@shared/media'
import { cn } from '../../lib/utils'

/**
 * Cover art with a dominant-colour placeholder.
 *
 * A music library grid is mostly empty boxes on first paint, which looks
 * broken. Drawing the album's dominant colour behind the image (sampled once
 * per image, cached, at a tiny 1x1 canvas) means the grid fills in with the
 * right colours immediately and only sharpens when the real cover arrives.
 */
const colourCache = new Map<string, string>()
// Failed extractions are remembered too, so a grid with broken covers does
// not retry the decode on every render.
const sampledIds = new Set<string>()

function extractDominantColour(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.src = src
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 1
        canvas.height = 1
        const context = canvas.getContext('2d', { willReadFrequently: true })
        if (!context) return resolve(null)
        context.drawImage(image, 0, 0, 1, 1)
        const [r, g, b] = context.getImageData(0, 0, 1, 1).data
        // Desaturate and darken slightly: cover-derived colours are usually
        // far too saturated to sit behind body text.
        const grey = 0.3 * r + 0.59 * g + 0.11 * b
        const value = Math.round(Math.min(255, grey * 0.75 + 26))
        resolve(`rgb(${value} ${value} ${value})`)
      } catch {
        resolve(null)
      }
    }
    image.onerror = () => resolve(null)
  })
}

export function CoverArt({
  id,
  size = 512,
  alt,
  className,
  rounded = 'rounded-lg',
  eager = false
}: {
  id?: string
  size?: number
  alt: string
  className?: string
  rounded?: string
  eager?: boolean
}) {
  const [loaded, setLoaded] = useState(false)
  const [tint, setTint] = useState<string | null>(() => (id ? colourCache.get(id) ?? null : null))

  const src = id ? coverMediaUrl(id, size) : placeholderCoverDataUrl()

  // A different cover means the old loaded/tint state no longer applies.
  // Adjust during render rather than in an effect to avoid a cascading render.
  const [prevId, setPrevId] = useState(id)
  if (prevId !== id) {
    setPrevId(id)
    setLoaded(false)
    setTint(id ? colourCache.get(id) ?? null : null)
  }

  // Sample once per cover id; a large grid would otherwise decode every
  // image twice.
  useEffect(() => {
    if (!id || tint !== null || sampledIds.has(id)) return
    sampledIds.add(id)
    void extractDominantColour(src).then((colour) => {
      if (colour && colourCache.size < 800) colourCache.set(id, colour)
      setTint(colour)
    })
  }, [id, src, tint])

  return (
    <div
      className={cn('relative overflow-hidden bg-surface-2', rounded, className)}
      style={tint ? { backgroundColor: tint } : undefined}
    >
      {!id && (
        <div className="absolute inset-0 grid place-items-center">
          <Music className="size-1/3 max-h-8 max-w-8 text-faint/50" />
        </div>
      )}
      {id && (
        <img
          src={src}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(false)}
          className={cn(
            'size-full object-cover transition-opacity duration-300',
            loaded ? 'opacity-100' : 'opacity-0'
          )}
        />
      )}
    </div>
  )
}

/** Circular avatar for a Navidrome user. */
export function Avatar({ username, size = 32 }: { username?: string; size?: number }) {
  return (
    <img
      // Resolved by the main process; Navidrome serves its own placeholder
      // when the user has no avatar.
      src={avatarMediaUrl(username)}
      alt={username ? `${username}'s avatar` : 'Avatar'}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className="shrink-0 rounded-full bg-surface-3 object-cover"
      draggable={false}
    />
  )
}
