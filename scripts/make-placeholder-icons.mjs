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

// The palette of `src/ui/tokens.css`.
const night = [0x14, 0x11, 0x34];
const owlBody = [0x7b, 0x6c, 0xf6];
const eyeWhite = [0xf8, 0xf6, 0xff];
const amber = [0xff, 0xc5, 0x3d];
const pupil = [0x0d, 0x0b, 0x20];
const beak = [0xff, 0x6f, 0x91];

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

// Draws one icon as rows of RGB pixels.
function draw({ size, safe }) {
  const pixels = Buffer.alloc(size * size * 3);
  // The owl's head fills the safe area; the eyes sit on its upper half.
  const centre = size / 2;
  const head = (size * safe) / 2;
  const eyeOffset = head * 0.42;
  const eyeRadius = head * 0.34;
  const irisRadius = eyeRadius * 0.78;
  const pupilRadius = eyeRadius * 0.36;
  const eyeY = centre - head * 0.12;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let colour = night;
      if (inCircle(x, y, centre, centre, head * 0.92)) colour = owlBody;
      for (const direction of [-1, 1]) {
        const eyeX = centre + direction * eyeOffset;
        if (inCircle(x, y, eyeX, eyeY, eyeRadius)) colour = eyeWhite;
        if (inCircle(x, y, eyeX, eyeY, irisRadius)) colour = amber;
        if (inCircle(x, y, eyeX, eyeY, pupilRadius)) colour = pupil;
      }
      if (inTriangle(x, y, centre, eyeY + eyeRadius * 1.25, head * 0.17)) colour = beak;
      const at = (y * size + x) * 3;
      pixels[at] = colour[0];
      pixels[at + 1] = colour[1];
      pixels[at + 2] = colour[2];
    }
  }
  return { size, pixels };
}

function inCircle(x, y, cx, cy, r) {
  const dx = x + 0.5 - cx;
  const dy = y + 0.5 - cy;
  return dx * dx + dy * dy <= r * r;
}

// A downward-pointing beak of half-width `half`.
function inTriangle(x, y, cx, topY, half) {
  const dy = y + 0.5 - topY;
  if (dy < 0 || dy > half * 1.4) return false;
  const width = half * (1 - dy / (half * 1.4));
  return Math.abs(x + 0.5 - cx) <= width;
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
