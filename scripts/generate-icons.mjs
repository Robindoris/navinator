/**
 * Derives every application icon from the master logo in `resources/`.
 *
 * Written by hand rather than pulled from a dependency so the icons are
 * reproducible from source with no extra tooling: PNG is decoded and encoded
 * directly and compressed with Node's built-in zlib.
 *
 *   node scripts/generate-icons.mjs
 *
 * `resources/navinator.png` is the master and is never written by this script.
 * Replace it with a new logo of the same role and re-run to refresh the tray
 * icon, the electron-builder source icon and the renderer asset.
 */
import { deflateSync, inflateSync } from 'node:zlib'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const source = join(root, 'resources', 'navinator.png')

/* -------------------------------------------------------------- PNG codec */

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buffer) {
  let c = -1
  for (let i = 0; i < buffer.length; i++) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([length, body, crc])
}

/** Encodes RGBA pixel data as a PNG buffer. */
function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type: RGBA
  ihdr[10] = 0 // deflate
  ihdr[11] = 0 // adaptive filtering
  ihdr[12] = 0 // no interlace

  // Each scanline is prefixed with its filter type; 0 (None) keeps this simple.
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

/** Undoes the per-scanline filters of an inflated PNG data block. */
function unfilter(raw, height, stride, bytesPerPixel) {
  const pixels = Buffer.alloc(height * stride)
  let pos = 0
  for (let y = 0; y < height; y++) {
    const type = raw[pos++]
    const line = pixels.subarray(y * stride, (y + 1) * stride)
    raw.copy(line, 0, pos, pos + stride)
    pos += stride
    const prior = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : null

    for (let x = 0; x < stride; x++) {
      const left = x >= bytesPerPixel ? line[x - bytesPerPixel] : 0
      const up = prior ? prior[x] : 0
      const upLeft = prior && x >= bytesPerPixel ? prior[x - bytesPerPixel] : 0

      switch (type) {
        case 0:
          break
        case 1:
          line[x] = (line[x] + left) & 0xff
          break
        case 2:
          line[x] = (line[x] + up) & 0xff
          break
        case 3:
          line[x] = (line[x] + ((left + up) >> 1)) & 0xff
          break
        case 4: {
          const p = left + up - upLeft
          const pa = Math.abs(p - left)
          const pb = Math.abs(p - up)
          const pc = Math.abs(p - upLeft)
          const nearest = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft
          line[x] = (line[x] + nearest) & 0xff
          break
        }
        default:
          throw new Error(`unsupported PNG filter type ${type} on row ${y}`)
      }
    }
  }
  return pixels
}

/** Decodes an 8-bit non-interlaced PNG into straight (non-premultiplied) RGBA. */
function decodePng(buffer) {
  if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG file')

  let width = 0
  let height = 0
  let colourType = 0
  const idat = []

  let pos = 8
  while (pos < buffer.length) {
    const length = buffer.readUInt32BE(pos)
    const type = buffer.toString('ascii', pos + 4, pos + 8)
    const data = buffer.subarray(pos + 8, pos + 8 + length)

    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      if (data[8] !== 8) throw new Error(`unsupported PNG bit depth ${data[8]}`)
      colourType = data[9]
      if (data[12] !== 0) throw new Error('interlaced PNG is not supported')
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') {
      break
    }
    pos += 12 + length
  }

  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colourType]
  if (!channels) throw new Error(`unsupported PNG colour type ${colourType}`)

  const stride = width * channels
  const pixels = unfilter(inflateSync(Buffer.concat(idat)), height, stride, channels)

  const rgba = Buffer.alloc(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    const s = i * channels
    const d = i * 4
    if (channels === 1) {
      rgba[d] = rgba[d + 1] = rgba[d + 2] = pixels[s]
      rgba[d + 3] = 255
    } else if (channels === 2) {
      rgba[d] = rgba[d + 1] = rgba[d + 2] = pixels[s]
      rgba[d + 3] = pixels[s + 1]
    } else {
      rgba[d] = pixels[s]
      rgba[d + 1] = pixels[s + 1]
      rgba[d + 2] = pixels[s + 2]
      rgba[d + 3] = channels === 4 ? pixels[s + 3] : 255
    }
  }

  return { width, height, rgba }
}

/* -------------------------------------------------------------- resampling */

/**
 * Area-average resample. Every source pixel that overlaps a destination pixel
 * contributes, which keeps the thin wave and rounded corners intact at tray
 * sizes where a naive nearest-neighbour sample would drop them.
 */
function resample(image, size) {
  const { width, height, rgba } = image
  const out = Buffer.alloc(size * size * 4)
  const scaleX = width / size
  const scaleY = height / size

  for (let y = 0; y < size; y++) {
    const y0 = y * scaleY
    const y1 = y0 + scaleY

    for (let x = 0; x < size; x++) {
      const x0 = x * scaleX
      const x1 = x0 + scaleX

      let r = 0
      let g = 0
      let b = 0
      let a = 0
      let weight = 0

      for (let sy = Math.floor(y0); sy < Math.min(height, Math.ceil(y1)); sy++) {
        const wy = Math.min(y1, sy + 1) - Math.max(y0, sy)
        if (wy <= 0) continue
        for (let sx = Math.floor(x0); sx < Math.min(width, Math.ceil(x1)); sx++) {
          const wx = Math.min(x1, sx + 1) - Math.max(x0, sx)
          if (wx <= 0) continue
          const w = wx * wy
          const i = (sy * width + sx) * 4
          r += rgba[i] * w
          g += rgba[i + 1] * w
          b += rgba[i + 2] * w
          a += rgba[i + 3] * w
          weight += w
        }
      }

      const d = (y * size + x) * 4
      out[d] = Math.round(r / weight)
      out[d + 1] = Math.round(g / weight)
      out[d + 2] = Math.round(b / weight)
      out[d + 3] = Math.round(a / weight)
    }
  }

  return { width: size, height: size, rgba: out }
}

/* ------------------------------------------------------------------ build */

const targets = [
  // electron-builder converts this into the .icns and .ico bundles.
  { path: join(root, 'resources', 'icon.png'), size: 1024 },
  { path: join(root, 'resources', 'tray.png'), size: 64 },
  // Served by Vite from the renderer public dir; used as favicon and in-app mark.
  { path: join(root, 'src', 'renderer', 'public', 'navinator.png'), size: 512 }
]

const master = decodePng(readFileSync(source))
if (master.width !== master.height) {
  throw new Error(`${source} must be square, got ${master.width}x${master.height}`)
}
console.log(`source  ${master.width}x${master.height}  resources/navinator.png`)

for (const target of targets) {
  mkdirSync(dirname(target.path), { recursive: true })
  const png = encodePng(target.size, target.size, resample(master, target.size).rgba)
  writeFileSync(target.path, png)
  console.log(`${target.path.replace(root + '/', '')}  ${target.size}x${target.size}  ${png.length} bytes`)
}
