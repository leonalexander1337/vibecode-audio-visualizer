// Renders public/icon-192.png and public/icon-512.png (same design as icon.svg).
// Run: node scripts/make-icons.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const WHITE = [242, 242, 242];
const RED = [255, 10, 20];

/** Color at a point in the 512×512 design space. */
function shade(x, y) {
  const dx = Math.abs(x - 256);
  const dy = Math.abs(y - 256);
  if (Math.max(dx, dy) < 20) return WHITE; // center square
  const diamond = (dx + dy) / Math.SQRT2; // rotated square, half-size 80 → 80 along its axes
  if (Math.abs(diamond - 80) < 10) return RED;
  if (Math.abs(Math.max(dx, dy) - 160) < 10) return WHITE; // outer frame
  return [0, 0, 0];
}

function png(size) {
  const ss = 4; // supersampling
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0];
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const c = shade(((x + (sx + 0.5) / ss) * 512) / size, ((y + (sy + 0.5) / ss) * 512) / size);
          for (let i = 0; i < 3; i++) acc[i] += c[i];
        }
      }
      const o = y * (size * 3 + 1) + 1 + x * 3;
      for (let i = 0; i < 3; i++) raw[o + i] = Math.round(acc[i] / (ss * ss));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

for (const size of [192, 512]) writeFileSync(`public/icon-${size}.png`, png(size));
console.log('icons written');
