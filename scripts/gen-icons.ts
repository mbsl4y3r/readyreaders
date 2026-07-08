/**
 * Dependency-free PWA icon generator.
 *
 * Renders simple RGBA pixel art — a deep navy rounded-corner background with
 * a warm gold five-pointed star centered — and writes valid PNGs using a
 * hand-rolled chunk writer (node:zlib for the IDAT deflate, manual CRC32).
 *
 * Run: npx tsx scripts/gen-icons.ts
 * Outputs: public/icons/icon-192.png, icon-512.png, apple-touch-icon.png
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const NAVY = { r: 0x0b, g: 0x25, b: 0x45 }; // #0b2545
const GOLD = { r: 0xff, g: 0xe9, b: 0xa8 }; // #ffe9a8

// ---------------------------------------------------------------- PNG writer

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/** Encode an RGBA pixel buffer (size×size×4) as a PNG file. */
function encodePng(size: number, rgba: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); // width
  ihdr.writeUInt32BE(size, 4); // height
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Raw scanlines: filter byte 0 (None) + row pixels.
  const raw = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * 4);
    raw[rowStart] = 0;
    rgba.subarray(y * size * 4, (y + 1) * size * 4).forEach((v, i) => {
      raw[rowStart + 1 + i] = v;
    });
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- rendering

/** Ray-casting point-in-polygon test. */
function inPolygon(px: number, py: number, poly: ReadonlyArray<readonly [number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** 10-vertex five-pointed star polygon, one point straight up. */
function starPolygon(cx: number, cy: number, outer: number): Array<readonly [number, number]> {
  const inner = outer * 0.42;
  const pts: Array<readonly [number, number]> = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

/** True if (x, y) is inside a rounded rect covering the full canvas. */
function inRoundedRect(x: number, y: number, size: number, radius: number): boolean {
  if (x < 0 || y < 0 || x > size || y > size) return false;
  const nx = Math.max(radius - x, x - (size - radius), 0);
  const ny = Math.max(radius - y, y - (size - radius), 0);
  return nx * nx + ny * ny <= radius * radius;
}

/**
 * Render the icon at `size`; 2× supersampling (4 samples/pixel) for smooth
 * star and corner edges. `roundedCorners: false` gives a full square (Apple
 * touch icons get their corners masked by iOS itself).
 */
function renderIcon(size: number, roundedCorners: boolean): Uint8Array {
  const rgba = new Uint8Array(size * size * 4);
  const radius = roundedCorners ? size * 0.2 : 0;
  const star = starPolygon(size / 2, size / 2 + size * 0.02, size * 0.34);
  const offsets = [0.25, 0.75];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (const oy of offsets) {
        for (const ox of offsets) {
          const sx = x + ox;
          const sy = y + oy;
          if (roundedCorners && !inRoundedRect(sx, sy, size, radius)) continue;
          const c = inPolygon(sx, sy, star) ? GOLD : NAVY;
          r += c.r;
          g += c.g;
          b += c.b;
          a += 255;
        }
      }
      const i = (y * size + x) * 4;
      // Average of 4 samples; color channels weighted by covered samples.
      const covered = a / 255;
      rgba[i] = covered ? Math.round(r / covered) : 0;
      rgba[i + 1] = covered ? Math.round(g / covered) : 0;
      rgba[i + 2] = covered ? Math.round(b / covered) : 0;
      rgba[i + 3] = Math.round(a / 4);
    }
  }
  return rgba;
}

// ------------------------------------------------------------------- main

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const targets: Array<{ file: string; size: number; rounded: boolean }> = [
  { file: 'icon-192.png', size: 192, rounded: true },
  { file: 'icon-512.png', size: 512, rounded: true },
  { file: 'apple-touch-icon.png', size: 180, rounded: false },
];

for (const { file, size, rounded } of targets) {
  const png = encodePng(size, renderIcon(size, rounded));
  const path = join(outDir, file);
  writeFileSync(path, png);
  console.log(`wrote ${path} (${size}x${size}, ${png.length} bytes)`);
}
