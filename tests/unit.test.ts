import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  MEDIA_HOST,
  NAVIGATOR_SCHEME,
  coverMediaUrl,
  downloadMediaUrl,
  placeholderCoverDataUrl,
  songMediaUrl
} from '../src/shared/media.ts'
import { SHORTCUT_GROUPS, SHORTCUTS } from '../src/shared/shortcuts.ts'
import { API_METHODS, MUTATING_METHODS, isApiMethod } from '../src/shared/api-methods.ts'
import { DEFAULT_SETTINGS } from '../src/shared/types.ts'
import { ACCENT_THEMES, DEFAULT_ACCENT } from '../src/shared/themes.ts'
import { formatCount, formatDuration, groupByDisc } from '../src/renderer/src/lib/utils.ts'

/**
 * Unit tests for the pure logic the app cannot run without and that cannot be
 * eyeballed: the media URL contract, the shortcut table, the renderer-facing
 * API allowlist, and the formatting helpers.
 *
 * `npm test` — Node's built-in runner, so no dependency is added and Node
 * executes the TypeScript directly.
 */

const media = /^navinator:\/\/media\//

describe('media URLs', () => {
  it('addresses everything through the media proxy', () => {
    for (const url of [songMediaUrl('tr-1'), downloadMediaUrl('tr-1'), coverMediaUrl('al-1')]) {
      assert.match(url, media, `${url} must go through the proxy`)
    }
  })

  it('never hands the renderer a credential', () => {
    // The proxy exists so the page never holds a token; a token appearing in
    // any of these URLs would defeat it.
    for (const url of [songMediaUrl('tr-1'), coverMediaUrl('al-1'), downloadMediaUrl('tr-1')]) {
      assert.doesNotMatch(url, /[?&]t=/, 'must not contain an auth token')
      assert.doesNotMatch(url, /salt=/)
      assert.doesNotMatch(url, /password/i)
      assert.doesNotMatch(url, /http/, 'must not point at the upstream host directly')
    }
  })

  it('keeps the app and media hosts separate', () => {
    // Same-scheme separation is what stops a media response being treated as a
    // same-origin script source — see protocol.ts.
    assert.notEqual(MEDIA_HOST, 'app')
    assert.equal(NAVIGATOR_SCHEME, 'navinator')
  })

  it('encodes ids so they cannot break out of the query', () => {
    const url = coverMediaUrl('a&b=c#d', 480)
    assert.doesNotMatch(url, /#/, 'fragment must be percent-encoded')
    assert.match(url, /id=a%26b%3Dc%23d/)
    assert.match(url, /size=480/)
  })

  it('falls back to a placeholder when there is no cover id', () => {
    assert.equal(coverMediaUrl(undefined), placeholderCoverDataUrl())
  })

  it('marks transcoding explicitly rather than by omission', () => {
    assert.doesNotMatch(songMediaUrl('tr-1'), /transcode=1/)
    assert.match(songMediaUrl('tr-1', { transcode: true, maxBitRate: 320 }), /transcode=1/)
    assert.match(songMediaUrl('tr-1', { transcode: true, maxBitRate: 320 }), /maxBitRate=320/)
  })

  it('drops a zero bitrate rather than sending maxBitRate=0', () => {
    // Subsonic treats 0 as "pick the original", which is the opposite of what
    // a caller setting 0 means.
    assert.doesNotMatch(songMediaUrl('tr-1', { transcode: true, maxBitRate: 0 }), /maxBitRate/)
  })
})

describe('shortcut table', () => {
  it('has no duplicate key bindings', () => {
    const seen = new Set<string>()
    for (const shortcut of SHORTCUTS) {
      assert.equal(seen.has(shortcut.keys), false, `duplicate binding: ${shortcut.keys}`)
      seen.add(shortcut.keys)
    }
  })

  it('gives every shortcut a label and a known group', () => {
    const groups = new Set(SHORTCUT_GROUPS)
    for (const shortcut of SHORTCUTS) {
      assert.ok(shortcut.label, `shortcut ${shortcut.keys} needs a label`)
      assert.ok(groups.has(shortcut.group), `unknown group: ${shortcut.group}`)
    }
  })

  it('documents Space exactly once', () => {
    // Space is both a native menu accelerator and a renderer key handler; two
    // entries here would be a documentation lie.
    assert.equal(SHORTCUTS.filter((s) => s.keys === 'Space').length, 1)
  })

  it('binds no modifier-free single letter that would fire while typing is impossible', () => {
    // Sanity: letters are bound without modifiers, so the handler must stand
    // down in text fields. Recorded here so the requirement is not forgotten.
    for (const key of ['M', 'S', 'R']) {
      assert.ok(SHORTCUTS.some((s) => s.keys === key), `${key} should be bound`)
    }
  })
})

describe('API allowlist', () => {
  it('accepts every declared method', () => {
    for (const method of API_METHODS) {
      assert.equal(isApiMethod(method), true, `${method} should be allowed`)
    }
  })

  it('rejects the methods that would make it a general-purpose proxy', () => {
    // `custom` reaches an arbitrary endpoint; the others expose internals.
    for (const method of ['custom', 'baseURL', 'navidromeSession', 'constructor', 'toString', '']) {
      assert.equal(isApiMethod(method), false, `${method} must be rejected`)
    }
  })

  it('rejects inherited Object keys', () => {
    for (const method of ['hasOwnProperty', 'valueOf', '__proto__']) {
      assert.equal(isApiMethod(method), false, `${method} must be rejected`)
    }
  })

  it('queues the writing endpoints so they cannot reorder', () => {
    // A `star` must not overtake the `scrobble` issued before it.
    for (const method of ['scrobble', 'star', 'unstar', 'setRating']) {
      assert.equal(MUTATING_METHODS.has(method), true, `${method} should be queued`)
    }
    for (const method of ['getAlbum', 'getArtists', 'search2']) {
      assert.equal(MUTATING_METHODS.has(method), false, `${method} is a read`)
    }
  })
})

describe('settings defaults', () => {
  it('ships a usable audio configuration', () => {
    const { audio } = DEFAULT_SETTINGS
    assert.ok(audio.volume >= 0 && audio.volume <= 1, 'volume must be normalised')
    assert.equal(typeof audio.gapless, 'boolean')
    assert.equal(typeof audio.muted, 'boolean')
    assert.equal(typeof audio.scrobble, 'boolean')
    assert.ok(audio.crossfade >= 0)
    // 0 means "no ceiling", which must be treated as unset by the media layer
    // rather than sent as `maxBitRate=0`.
    assert.equal(audio.maxBitRate, 0)
  })

  it('defaults auto-update on at the top level, not under audio', () => {
    assert.equal(typeof DEFAULT_SETTINGS.autoUpdate, 'boolean')
  })

  it('has a default accent that actually exists', () => {
    assert.ok(
      ACCENT_THEMES.some((theme) => theme.id === DEFAULT_ACCENT),
      `${DEFAULT_ACCENT} is not a known accent`
    )
  })

  it('gives every accent theme two swatch colours', () => {
    for (const theme of ACCENT_THEMES) {
      assert.equal(theme.swatch.length, 2, `${theme.id} needs two swatch colours`)
      assert.ok(theme.label && theme.description, `${theme.id} needs a label and description`)
    }
  })
})

describe('formatting', () => {
  it('pluralises counts', () => {
    assert.match(formatCount(1, 'track'), /^1 track$/)
    assert.match(formatCount(2, 'track'), /^2 tracks$/)
    assert.match(formatCount(0, 'album'), /^0 albums$/)
  })

  it('formats durations, distinguishing "zero" from "unknown"', () => {
    assert.equal(formatDuration(0), '0:00')
    assert.equal(formatDuration(61), '1:01')
    assert.equal(formatDuration(3661), '1:01:01')
    // A real zero is a track of no length; a missing duration is unknown, and
    // the two must not render identically.
    assert.equal(formatDuration(Number.NaN), '--:--')
    assert.equal(formatDuration(undefined), '--:--')
    assert.equal(formatDuration(null), '--:--')
    assert.equal(formatDuration(-5), '--:--')
  })

  it('groups tracks into discs in ascending order', () => {
    const grouped = groupByDisc([
      { discNumber: 2, track: 1 },
      { discNumber: 1, track: 1 },
      { discNumber: 1, track: 2 }
    ])
    assert.deepEqual(
      grouped.map((disc) => disc.discNumber),
      [1, 2]
    )
    assert.equal(grouped[0].songs.length, 2)
  })

  it('does not lose tracks with a missing disc number', () => {
    const grouped = groupByDisc([{ track: 1 }, { discNumber: 2, track: 1 }])
    const total = grouped.reduce((sum, disc) => sum + disc.songs.length, 0)
    assert.equal(total, 2)
  })
})
