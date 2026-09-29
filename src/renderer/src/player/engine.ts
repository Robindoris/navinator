import { radioMediaUrl, songMediaUrl, resolveStreamOptions } from '@shared/media'
import type { AudioSettings, Song } from '@shared/types'

/**
 * Two-deck gapless audio engine.
 *
 * Why not a single `<audio>` element: every browser pauses between tracks, so
 * an album plays with an audible gap. The fix is to keep a second element
 * pre-loaded with the next track and swap to it the instant the first one
 * ends, so playback is continuous.
 *
 * Why not a library: Howler has not been maintained since 2023 and no current
 * Electron music client uses it. The native element is also the only way to
 * get Chromium's full codec support, which matters because we deliberately
 * stream originals rather than transcoding everything.
 *
 * Crossfade is layered on top by ramping the outgoing deck's gain instead of
 * hard-cutting it.
 */
export class AudioEngine {
  private decks: HTMLAudioElement[] = [new Audio(), new Audio()]
  /** Index of the deck currently producing sound. */
  private active = 0
  private queue: Song[] = []
  private index = 0
  private settings: Pick<AudioSettings, 'volume' | 'muted' | 'gapless' | 'crossfade' | 'transcode' | 'maxBitRate' | 'format' | 'jukebox'> = {
    volume: 0.8,
    muted: false,
    gapless: true,
    crossfade: 0,
    transcode: true,
    maxBitRate: 0,
    format: 'raw',
    jukebox: false
  }
  private stopped = false

  private listeners = {
    trackChange: [] as ((index: number) => void)[],
    stateChange: [] as ((playing: boolean) => void)[],
    progress: [] as ((currentTime: number, duration: number, buffered: number) => void)[],
    ended: [] as (() => void)[],
    error: [] as ((message: string) => void)[]
  }

  constructor() {
    for (const [i, deck] of this.decks.entries()) {
      deck.preload = 'auto'
      // Cross-deck fades rely on independent gain nodes.
      deck.volume = i === 0 ? this.settings.volume : 0
      deck.addEventListener('ended', () => this.handleEnded(i))
      deck.addEventListener('error', () => this.handleError(i))
      deck.addEventListener('play', () => this.emit(this.listeners.stateChange, !deck.paused))
      deck.addEventListener('pause', () => this.emit(this.listeners.stateChange, !deck.paused))
      deck.addEventListener('timeupdate', () => this.handleTimeUpdate(i))
    }
  }

  private emit<T extends unknown[]>(list: ((...args: T) => void)[], ...args: T): void {
    for (const fn of list) {
      try {
        fn(...args)
      } catch (error) {
        console.error('[engine] listener failed', error)
      }
    }
  }

  on<K extends keyof typeof this.listeners>(event: K, handler: (typeof this.listeners)[K][number]): () => void {
    const list = this.listeners[event] as ((...args: never[]) => void)[]
    list.push(handler as (...args: never[]) => void)
    return () => {
      const index = list.indexOf(handler as (...args: never[]) => void)
      if (index >= 0) list.splice(index, 1)
    }
  }

  /* ------------------------------------------------------------- controls */

  setQueue(songs: Song[], startIndex = 0, autoplay = false): void {
    this.queue = songs
    this.index = Math.max(0, Math.min(startIndex, songs.length - 1))
    this.stopped = false
    if (songs.length === 0) {
      for (const deck of this.decks) deck.pause()
      this.index = -1
      this.emit(this.listeners.trackChange, -1)
      return
    }
    this.load(this.active, this.index, autoplay)
    this.emit(this.listeners.trackChange, this.index)
    if (this.settings.gapless) this.preloadNext()
  }

  private idleDeck(): number {
    return this.active === 0 ? 1 : 0
  }

  private urlFor(song: Song): string {
    // A station is proxied by its own id, so none of the transcode options
    // apply — the server has already decided the codec.
    if (song.isRadio) return radioMediaUrl(song.id)
    const options = resolveStreamOptions(song, this.settings)
    return songMediaUrl(song.id, { ...options, jukebox: this.settings.jukebox })
  }

  private load(deckIndex: number, queueIndex: number, autoplay: boolean): void {
    const song = this.queue[queueIndex]
    if (!song) return
    const deck = this.decks[deckIndex]
    deck.src = this.urlFor(song)
    deck.currentTime = 0
    // Restore the gain this deck had before it was parked.
    deck.volume = deckIndex === this.active ? this.settings.volume : 0
    if (autoplay) {
      void deck.play().catch((error: unknown) => {
        if (this.stopped) return
        this.emit(this.listeners.error, error instanceof Error ? error.message : 'Playback was blocked')
      })
    }
  }

  /**
   * Quietly loads the upcoming track into the spare deck so it can start
   * instantly. Failure is expected and ignored — the track will be loaded
   * normally when it actually comes up.
   */
  private preloadNext(): void {
    const next = this.index + 1
    if (next >= this.queue.length) return
    const deck = this.decks[this.idleDeck()]
    const url = this.urlFor(this.queue[next])
    if (deck.src === url) return
    deck.src = url
    deck.load()
  }

  private handleEnded(deckIndex: number): void {
    if (deckIndex !== this.active) return
    this.emit(this.listeners.ended)
  }

  private handleError(deckIndex: number): void {
    // Ignore the error a parked deck raises when its src is swapped out.
    if (deckIndex !== this.active) return
    const song = this.queue[this.index]
    this.emit(this.listeners.error, `Could not play ${song?.title ?? 'track'}`)
  }

  private handleTimeUpdate(deckIndex: number): void {
    if (deckIndex !== this.active) return
    const deck = this.decks[deckIndex]
    const buffered = deck.buffered.length ? deck.buffered.end(deck.buffered.length - 1) : 0
    this.emit(this.listeners.progress, deck.currentTime, deck.duration || 0, buffered)
  }

  /* ------------------------------------------------------- queue movement */

  /**
   * Advances to `target`. When gapless is on and a crossfade is configured the
   * outgoing deck is faded out rather than hard-stopped; otherwise the swap is
   * instantaneous, which is what makes album playback seamless.
   */
  private transitionTo(target: number, autoplay: boolean): void {
    const outgoing = this.decks[this.active]
    const incoming = this.decks[this.idleDeck()]
    const song = this.queue[target]
    if (!song) return

    this.active = this.idleDeck()
    this.index = target

    const crossfadeMs = this.settings.gapless ? this.settings.crossfade : 0
    const url = this.urlFor(song)

    if (crossfadeMs > 0 && autoplay) {
      // The spare deck normally already holds this track, but an arbitrary
      // jump (queue click, "play album" from the sidebar) may not have
      // preloaded it.
      if (incoming.src !== url) {
        incoming.src = url
        incoming.load()
      }
      incoming.currentTime = 0
      incoming.volume = 0
      void incoming.play().catch(() => undefined)
      this.fade(incoming, crossfadeMs)
      this.fade(outgoing, crossfadeMs, true)
    } else {
      outgoing.pause()
      outgoing.currentTime = 0
      outgoing.volume = this.settings.volume
      this.load(this.active, this.index, autoplay)
    }

    this.emit(this.listeners.trackChange, this.index)
    if (this.settings.gapless) this.preloadNext()
  }

  private fade(deck: HTMLAudioElement, duration: number, fadeOut = false): void {
    const start = performance.now()
    const from = fadeOut ? this.settings.volume : 0
    const to = fadeOut ? 0 : this.settings.volume
    const step = (): void => {
      const progress = Math.min(1, (performance.now() - start) / duration)
      deck.volume = from + (to - from) * progress
      if (progress < 1) requestAnimationFrame(step)
      else if (fadeOut) {
        deck.pause()
        deck.currentTime = 0
      }
    }
    requestAnimationFrame(step)
  }

  play(): void {
    if (this.queue.length === 0) return
    this.stopped = false
    const deck = this.decks[this.active]
    if (!deck.src) {
      this.load(this.active, this.index, true)
      return
    }
    void deck.play().catch((error: unknown) => {
      this.emit(this.listeners.error, error instanceof Error ? error.message : 'Playback was blocked')
    })
  }

  pause(): void {
    this.stopped = true
    this.decks[this.active].pause()
  }

  toggle(): void {
    if (this.decks[this.active].paused) this.play()
    else this.pause()
  }

  get isPlaying(): boolean {
    return !this.decks[this.active].paused
  }

  get currentIndex(): number {
    return this.index
  }

  get currentSong(): Song | undefined {
    return this.queue[this.index]
  }

  /** Moves within the queue. `delta` is normally ±1. */
  skip(delta: number, autoplay: boolean): void {
    const target = this.index + delta
    if (target < 0) {
      this.seek(0)
      return
    }
    if (target >= this.queue.length) {
      this.emit(this.listeners.ended)
      return
    }
    this.transitionTo(target, autoplay)
  }

  /** Jumps to a specific queue position. */
  jumpTo(index: number, autoplay: boolean): void {
    if (index < 0 || index >= this.queue.length) return
    this.transitionTo(index, autoplay)
  }

  /**
   * Called when the current track ran out. Uses the preloaded deck when the
   * settings allow it, which is what removes the inter-track gap.
   */
  advanceAfterEnd(): void {
    const next = this.index + 1
    if (next >= this.queue.length) {
      // At the end of the queue the caller decides whether to stop or repeat.
      this.pause()
      this.decks[this.active].currentTime = 0
      this.emit(this.listeners.stateChange, false)
      return
    }
    if (this.settings.gapless) {
      this.transitionTo(next, true)
    } else {
      this.transitionTo(next, this.isPlaying)
    }
  }

  seek(seconds: number): void {
    const deck = this.decks[this.active]
    if (!Number.isFinite(deck.duration) || deck.duration === 0) return
    deck.currentTime = Math.min(Math.max(0, seconds), deck.duration)
  }

  get position(): number {
    return this.decks[this.active].currentTime || 0
  }

  get duration(): number {
    const value = this.decks[this.active].duration
    return Number.isFinite(value) ? value : 0
  }

  get buffered(): number {
    const deck = this.decks[this.active]
    return deck.buffered.length ? deck.buffered.end(deck.buffered.length - 1) : 0
  }

  setVolume(volume: number): void {
    this.settings.volume = Math.min(1, Math.max(0, volume))
    if (!this.settings.muted) this.decks[this.active].volume = this.settings.volume
  }

  get volume(): number {
    return this.settings.volume
  }

  setMuted(muted: boolean): void {
    this.settings.muted = muted
    this.decks[this.active].volume = muted ? 0 : this.settings.volume
  }

  get muted(): boolean {
    return this.settings.muted
  }

  /**
   * Applies new audio settings.
   *
   * `reloadOnStreamChange` forces the current track to be re-resolved, which is
   * what the bitrate/format controls need: a track already streaming cannot
   * change codec halfway through.
   */
  update(
    settings: Partial<typeof this.settings>,
    options: { reloadOnStreamChange?: boolean } = {}
  ): void {
    const previous = { ...this.settings }
    Object.assign(this.settings, settings)
    this.setVolume(this.settings.volume)
    this.setMuted(this.settings.muted)

    const streamChanged =
      previous.transcode !== this.settings.transcode ||
      previous.maxBitRate !== this.settings.maxBitRate ||
      previous.format !== this.settings.format ||
      previous.jukebox !== this.settings.jukebox

    if (streamChanged && options.reloadOnStreamChange && this.queue.length > 0) {
      const resumeAt = this.position
      const wasPlaying = this.isPlaying
      this.decks[this.active].src = this.urlFor(this.currentSong!)
      this.decks[this.active].currentTime = 0
      if (wasPlaying) {
        void this.decks[this.active].play().catch(() => undefined)
        this.seek(resumeAt)
      }
      if (this.settings.gapless) this.preloadNext()
    }
  }

  /** Tears everything down; used on disconnect and window close. */
  destroy(): void {
    this.stopped = true
    for (const deck of this.decks) {
      deck.pause()
      deck.removeAttribute('src')
      deck.load()
    }
    this.queue = []
    this.index = 0
  }
}
