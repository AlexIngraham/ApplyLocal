import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
mkdirSync(dir, { recursive: true })

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i]
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1)
    raw[row] = 0
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = pixel(x, y, size)
      const i = row + 1 + x * 4
      raw[i] = r
      raw[i + 1] = g
      raw[i + 2] = b
      raw[i + 3] = a
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function pixel(x, y, size) {
  const pad = Math.max(1, Math.round(size * 0.08))
  const radius = Math.max(2, Math.round(size * 0.22))
  const max = size - pad
  if (x < pad || y < pad || x >= max || y >= max) return [0, 0, 0, 0]
  const cornerX = x < size / 2 ? pad + radius : max - radius
  const cornerY = y < size / 2 ? pad + radius : max - radius
  const inCornerZone = (x < pad + radius || x >= max - radius) && (y < pad + radius || y >= max - radius)
  if (inCornerZone && (x - cornerX) ** 2 + (y - cornerY) ** 2 > radius ** 2) return [0, 0, 0, 0]
  const line = (y0, x0, x1, thickness) =>
    y >= y0 && y < y0 + thickness && x >= x0 && x < x1
  const t = Math.max(1, Math.round(size * 0.08))
  if (line(Math.round(size * 0.36), Math.round(size * 0.28), Math.round(size * 0.72), t)) return [255, 252, 247, 255]
  if (line(Math.round(size * 0.56), Math.round(size * 0.28), Math.round(size * 0.52), t)) return [255, 252, 247, 255]
  return [29, 107, 69, 255]
}

for (const size of [16, 32, 48, 128]) {
  writeFileSync(join(dir, `icon${size}.png`), png(size, pixel))
}
