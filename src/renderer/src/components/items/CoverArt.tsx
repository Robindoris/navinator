import { useEffect, useRef, useState } from 'react'
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
// not retry the decode on every render. Bounded for the same reason
// `colourCache` is: a long session scrolling a large library would otherwise
// grow this without limit.
const sampledIds = new Set<string>()
const MAX_SAMPLED_IDS = 4000

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
  /**
   * Distinct from `loaded`: `onError` used to set `loaded = false`, which is also
   * the initial value, so a broken cover stayed at `opacity-0` forever and the
   * user saw an empty tinted box with nothing in it.
   */
  const [failed, setFailed] = useState(false)
  const [tint, setTint] = useState<string | null>(() => (id ? colourCache.get(id) ?? null : null))
  /** Whether this card has come near the viewport, and so may be sampled. */
  const [sampled, setSampled] = useState(eager)
  const ref = useRef<HTMLDivElement>(null)

  const src = id ? coverMediaUrl(id, size) : placeholderCoverDataUrl()

  // A different cover means the old loaded/tint state no longer applies.
  // Adjust during render rather than in an effect to avoid a cascading render.
  const [prevId, setPrevId] = useState(id)
  if (prevId !== id) {
    setPrevId(id)
    setLoaded(false)
    setFailed(false)
    setTint(id ? colourCache.get(id) ?? null : null)
  }

  // Wait until the card is near the viewport before sampling it.
  //
  // `loading="lazy"` on the <img> below only defers that element's own fetch.
  // `extractDominantColour` constructs a *separate* `Image`, which the browser
  // has no way to lazy-load — so without this gate the entire grid's artwork,
  // off-screen cards included, is fetched and decoded up front. On a library of
  // 10,000 albums that is every cover on the server, at once, each as a
  // main-process `net.fetch` through the media proxy.
  useEffect(() => {
    if (eager || sampled) return
    const node = ref.current
    if (!node || typeof IntersectionObserver === 'undefined') {
      // No observer support: fall back to sampling immediately rather than
      // never painting a placeholder colour.
      setSampled(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return
        setSampled(true)
        observer.disconnect()
      },
      // Slightly generous: a tint that lands just after the cover is still
      // better than an empty grey box.
      { rootMargin: '400px' }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [eager, sampled])

  // Sample once per cover id, and only once it is worth sampling.
  useEffect(() => {
    if (!id || !sampled || tint !== null || sampledIds.has(id)) return
    sampledIds.add(id)
    if (sampledIds.size > MAX_SAMPLED_IDS) sampledIds.clear()
    // A cover id can change under us (PlayerBar swaps covers without a remount);
    // a late sample for the old id must not repaint the new one.
    let cancelled = false
    void extractDominantColour(src).then((colour) => {
      if (cancelled) return
      if (colour && colourCache.size < 800) colourCache.set(id, colour)
      setTint(colour)
    })
    return () => {
      cancelled = true
    }
  }, [id, src, tint, sampled])

  return (
    <div
      ref={ref}
      className={cn('relative overflow-hidden bg-surface-2', rounded, className)}
      style={tint ? { backgroundColor: tint } : undefined}
    >
      {(!id || failed) && (
        <div className="absolute inset-0 grid place-items-center">
          <Music className="size-1/3 max-h-8 max-w-8 text-faint/50" />
        </div>
      )}
      {id && !failed && (
        <img
          src={src}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
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
