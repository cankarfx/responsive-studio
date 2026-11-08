// Bağımlılıksız PNG ikon üretici (4x süper-örnekleme ile kenar yumuşatma)
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SS = 4 // süper-örnekleme çarpanı

function crc32(buf) {
  let c, table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

function encodePNG(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function makeCanvas(n) {
  return { n, px: new Float64Array(n * n * 4) }
}

function blend(c, x, y, [r, g, b, a]) {
  if (x < 0 || y < 0 || x >= c.n || y >= c.n) return
  const i = (y * c.n + x) * 4
  const dst = c.px
  const ia = 1 - a
  dst[i] = r * a + dst[i] * ia
  dst[i + 1] = g * a + dst[i + 1] * ia
  dst[i + 2] = b * a + dst[i + 2] * ia
  dst[i + 3] = a + dst[i + 3] * ia
}

function roundRect(c, x, y, w, h, r, color) {
  for (let py = Math.floor(y); py < Math.ceil(y + h); py++) {
    for (let px = Math.floor(x); px < Math.ceil(x + w); px++) {
      const cx = px + 0.5, cy = py + 0.5
      if (cx < x || cx > x + w || cy < y || cy > y + h) continue
      const dx = Math.max(x + r - cx, cx - (x + w - r), 0)
      const dy = Math.max(y + r - cy, cy - (y + h - r), 0)
      if (dx * dx + dy * dy > r * r) continue
      blend(c, px, py, color)
    }
  }
}

function downsample(c, out) {
  const rgba = Buffer.alloc(out * out * 4)
  const f = c.n / out
  for (let y = 0; y < out; y++) {
    for (let x = 0; x < out; x++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sy = 0; sy < f; sy++) {
        for (let sx = 0; sx < f; sx++) {
          const i = ((y * f + sy) * c.n + (x * f + sx)) * 4
          r += c.px[i]; g += c.px[i + 1]; b += c.px[i + 2]; a += c.px[i + 3]
        }
      }
      const t = f * f, o = (y * out + x) * 4
      rgba[o] = Math.round(r / t); rgba[o + 1] = Math.round(g / t)
      rgba[o + 2] = Math.round(b / t); rgba[o + 3] = Math.round((a / t) * 255)
    }
  }
  return rgba
}

const INDIGO = [99, 102, 241, 1]
const WHITE = [255, 255, 255, 1]
const SLATE = [15, 23, 42, 1]

function draw(size) {
  const n = size * SS
  const c = makeCanvas(n)
  const u = n / 32 // 32 birimlik tasarım ızgarası

  // arka plan
  roundRect(c, 0, 0, n, n, 7 * u, INDIGO)
  // masaüstü ekran (geniş)
  roundRect(c, 4 * u, 6 * u, 17 * u, 12 * u, 1.5 * u, WHITE)
  roundRect(c, 6 * u, 8.5 * u, 13 * u, 1.2 * u, 0.6 * u, SLATE)
  roundRect(c, 6 * u, 11 * u, 9 * u, 1.2 * u, 0.6 * u, SLATE)
  // masaüstü ayak
  roundRect(c, 9.5 * u, 18 * u, 6 * u, 1.6 * u, 0.8 * u, WHITE)
  // telefon (sağ alt, üste biner)
  roundRect(c, 19 * u, 13 * u, 9 * u, 15 * u, 2 * u, INDIGO)
  roundRect(c, 20 * u, 14 * u, 7 * u, 13 * u, 1.4 * u, WHITE)
  roundRect(c, 21.4 * u, 16 * u, 4.2 * u, 1 * u, 0.5 * u, SLATE)
  roundRect(c, 21.4 * u, 18 * u, 2.8 * u, 1 * u, 0.5 * u, SLATE)

  return encodePNG(size, size, downsample(c, size))
}

mkdirSync(resolve(ROOT, 'public/icons'), { recursive: true })
for (const s of [16, 32, 48, 128]) {
  writeFileSync(resolve(ROOT, `public/icons/icon-${s}.png`), draw(s))
}
console.log('✓ ikonlar üretildi: 16, 32, 48, 128')
