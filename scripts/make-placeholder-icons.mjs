#!/usr/bin/env node
// Writes the placeholder app icons (`npm run icons`).
//
// The app has to be installable before the creator supplies the real artwork: a browser refuses
// to offer installation without the icons the manifest names, and the service worker precaches
// them. These are deliberately plain — the night square and the owl's two amber eyes of
// `public/favicon.svg`, drawn by hand in pixels — and they are replaced by the real files the
// moment they exist (docs/design/ASSETS.md). There is no raster library in this repository, so
// the PNGs are encoded here with `zlib`, which Node ships.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const iconsDirectory = join(root, 'apps/web/public/assets/icons');

// The primitives of `src/ui/tokens/primitives.css` ("Ink & Sticker", C-03).
const paper = [0xfa, 0xf6, 0xef];
const marigold = [0xff, 0xc4, 0x3d];
const ink = [0x23, 0x20, 0x1c];

// `safe` is the fraction of the square the drawing stays inside: a maskable icon may be cropped
// to a circle, so its art lives in the middle 80 %.
// Every icon is an opaque square: iOS turns transparency black, and a maskable icon is cropped
// by the system to whatever shape the launcher uses.
const icons = [
  { file: 'icon-192.png', size: 192, safe: 1 },
  { file: 'icon-512.png', size: 512, safe: 1 },
  { file: 'icon-maskable-512.png', size: 512, safe: 0.8 },
  { file: 'apple-touch-icon.png', size: 180, safe: 1 },
];

// Draws one icon as rows of RGB pixels: a marigold sticker on paper, outlined
// in ink, with the ink play triangle inside it.
function draw({ size, safe }) {
  const pixels = Buffer.alloc(size * size * 3);
  const centre = size / 2;
  const half = (size * safe) / 2;
  const outline = Math.max(2, Math.round(size * 0.035));
  const radius = half * 0.3;
  const triangle = half * 0.5;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let colour = paper;
      if (inRoundedSquare(x, y, centre, half, radius)) colour = ink;
      if (inRoundedSquare(x, y, centre, half - outline, radius)) colour = marigold;
      if (inPlayTriangle(x, y, centre, triangle)) colour = ink;
      const at = (y * size + x) * 3;
      pixels[at] = colour[0];
      pixels[at + 1] = colour[1];
      pixels[at + 2] = colour[2];
    }
  }
  return { size, pixels };
}

// A square of half-size `half` around (cx, cx) with corners of radius `r`.
function inRoundedSquare(x, y, centre, half, r) {
  const dx = Math.abs(x + 0.5 - centre);
  const dy = Math.abs(y + 0.5 - centre);
  if (dx > half || dy > half) return false;
  const ox = dx - (half - r);
  const oy = dy - (half - r);
  if (ox <= 0 || oy <= 0) return true;
  return ox * ox + oy * oy <= r * r;
}

// A right-pointing triangle of half-height `half`, centred on the square.
function inPlayTriangle(x, y, centre, half) {
  const dx = x + 0.5 - (centre - half * 0.55);
  const dy = y + 0.5 - centre;
  if (dx < 0 || dx > half * 1.5) return false;
  const reach = half * (1 - dx / (half * 1.5));
  return Math.abs(dy) <= reach;
}

// A minimal PNG: 8-bit RGB, no interlacing, one zlib stream of filtered rows.
function png({ size, pixels }) {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 3 + 1)] = 0; // filter type 0 (none)
    pixels.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // colour type: truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

mkdirSync(iconsDirectory, { recursive: true });
for (const icon of icons) {
  writeFileSync(join(iconsDirectory, icon.file), png(draw(icon)));
  console.log(`wrote ${icon.file} (${icon.size}x${icon.size})`);
}
