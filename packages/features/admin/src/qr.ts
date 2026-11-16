// A QR encoder, so the otpauth URI of an enrollment is drawn in this browser and the secret never
// reaches anyone else (D-015: it is shown once). Byte mode, error correction level M, versions 1
// to 10 — an otpauth URI is about 150 bytes, well inside version 8. ISO/IEC 18004.

export interface QrMatrix {
  // Modules per side, without the quiet zone (which the drawing adds).
  size: number;
  // `modules[y][x]`: true is dark.
  modules: boolean[][];
}

// Data codewords and block structure per version at level M: error-correction codewords per
// block, then the blocks of each group (a second group's blocks hold one data codeword more).
export const qrVersions: { ec: number; groups: [blocks: number, data: number][] }[] = [
  { ec: 10, groups: [[1, 16]] },
  { ec: 16, groups: [[1, 28]] },
  { ec: 26, groups: [[1, 44]] },
  { ec: 18, groups: [[2, 32]] },
  { ec: 24, groups: [[2, 43]] },
  { ec: 16, groups: [[4, 27]] },
  { ec: 18, groups: [[4, 31]] },
  {
    ec: 22,
    groups: [
      [2, 38],
      [2, 39],
    ],
  },
  {
    ec: 22,
    groups: [
      [3, 36],
      [2, 37],
    ],
  },
  {
    ec: 26,
    groups: [
      [4, 43],
      [1, 44],
    ],
  },
];

// Centres of the alignment patterns, per version. Version 1 has none.
const alignmentCentres: number[][] = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
];

// Bits left over after the interleaved codewords, written as zeros.
const remainderBits = [0, 7, 7, 7, 7, 7, 0, 0, 0, 0];

// Error correction level M, as the two bits the format information carries.
const levelMBits = 0b00;

// --- The bit stream -------------------------------------------------------

function dataCodewords(version: number): number {
  return qrVersions[version - 1]!.groups.reduce((sum, [blocks, data]) => sum + blocks * data, 0);
}

// Byte mode spends 4 bits on the mode and 8 (to version 9) or 16 bits on the length.
function capacity(version: number): number {
  const header = 4 + (version < 10 ? 8 : 16);
  return Math.floor((dataCodewords(version) * 8 - header) / 8);
}

// The longest text this encoder can draw.
export const qrMaxBytes = capacity(qrVersions.length);

// The matrix for `text`, or null when it does not fit (the caller then shows the text alone — the
// secret is always readable without the picture).
export function encodeQr(text: string): QrMatrix | null {
  const data = new TextEncoder().encode(text);
  const version = qrVersions.findIndex((_, index) => capacity(index + 1) >= data.length) + 1;
  if (version === 0) return null;

  const codewords = interleave(version, bitStream(version, data));
  const size = 17 + 4 * version;
  const modules: (boolean | null)[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => null),
  );
  const reserved: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false),
  );
  drawFunctionPatterns(modules, reserved, version);
  placeData(modules, reserved, codewords, remainderBits[version - 1]!);

  // The mask that makes the symbol easiest to read is chosen by the standard's four penalties.
  let best: boolean[][] | null = null;
  let bestPenalty = Number.POSITIVE_INFINITY;
  for (let mask = 0; mask < 8; mask += 1) {
    const candidate = modules.map((row, y) =>
      row.map((value, x) => (reserved[y]![x] ? value === true : value !== maskBit(mask, x, y))),
    );
    drawFormatInformation(candidate, mask);
    if (version >= 7) drawVersionInformation(candidate, version);
    const penalty = penaltyOf(candidate);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      best = candidate;
    }
  }
  return { size, modules: best! };
}

function bitStream(version: number, data: Uint8Array): number[] {
  const total = dataCodewords(version);
  const bits: number[] = [];
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i -= 1) bits.push((value >> i) & 1);
  };
  push(0b0100, 4);
  push(data.length, version < 10 ? 8 : 16);
  for (const byte of data) push(byte, 8);

  for (let i = 0; i < 4 && bits.length < total * 8; i += 1) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);
  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    codewords.push(bits.slice(i, i + 8).reduce((value, bit) => (value << 1) | bit, 0));
  }
  // The two padding codewords alternate until the version's data is full.
  const padding = [0xec, 0x11];
  for (let i = 0; codewords.length < total; i += 1) codewords.push(padding[i % 2]!);
  return codewords;
}

// --- Reed-Solomon over GF(256), primitive polynomial 0x11D ----------------

const exp = new Uint8Array(512);
const log = new Uint8Array(256);
for (let i = 0, value = 1; i < 255; i += 1) {
  exp[i] = value;
  log[value] = i;
  value <<= 1;
  if (value & 0x100) value ^= 0x11d;
}
for (let i = 255; i < 512; i += 1) exp[i] = exp[i - 255]!;

function multiply(a: number, b: number): number {
  return a === 0 || b === 0 ? 0 : exp[log[a]! + log[b]!]!;
}

// The generator polynomial of `degree`, as coefficients from the highest power down.
function generator(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j += 1) {
      next[j] = next[j]! ^ poly[j]!;
      next[j + 1] = next[j + 1]! ^ multiply(poly[j]!, exp[i]!);
    }
    poly = next;
  }
  return poly;
}

// The `degree` error-correction codewords of one block: the remainder of dividing the block,
// shifted up by `degree`, by the generator polynomial.
export function errorCorrection(block: readonly number[], degree: number): number[] {
  const poly = generator(degree);
  const remainder = new Array<number>(degree).fill(0);
  for (const byte of block) {
    const factor = byte ^ remainder[0]!;
    remainder.shift();
    remainder.push(0);
    if (factor === 0) continue;
    for (let i = 0; i < degree; i += 1)
      remainder[i] = remainder[i]! ^ multiply(poly[i + 1]!, factor);
  }
  return remainder;
}

// Data codewords block by block, then the error-correction codewords block by block, each read
// one column at a time as the standard interleaves them.
function interleave(version: number, codewords: readonly number[]): number[] {
  const blocks = blocksOf(version, codewords);
  const { ec } = qrVersions[version - 1]!;
  const parities = blocks.map((block) => errorCorrection(block, ec));
  const out: number[] = [];
  const longest = Math.max(...blocks.map((block) => block.length));
  for (let i = 0; i < longest; i += 1) {
    for (const block of blocks) if (i < block.length) out.push(block[i]!);
  }
  for (let i = 0; i < ec; i += 1) for (const parity of parities) out.push(parity[i]!);
  return out;
}

// The data codewords cut into the version's blocks.
export function blocksOf(version: number, codewords: readonly number[]): number[][] {
  const blocks: number[][] = [];
  let at = 0;
  for (const [count, size] of qrVersions[version - 1]!.groups) {
    for (let i = 0; i < count; i += 1) {
      blocks.push([...codewords.slice(at, at + size)]);
      at += size;
    }
  }
  return blocks;
}

// --- The matrix -----------------------------------------------------------

// Which modules of a version's symbol are function patterns rather than data: the finders and
// their separators, the alignment and timing patterns, the dark module and the areas the format
// and version information are written in.
export function qrFunctionModules(version: number): boolean[][] {
  const size = 17 + 4 * version;
  const modules: (boolean | null)[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => null),
  );
  const reserved: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false),
  );
  drawFunctionPatterns(modules, reserved, version);
  return reserved;
}

function drawFunctionPatterns(
  modules: (boolean | null)[][],
  reserved: boolean[][],
  version: number,
): void {
  const size = modules.length;
  const set = (x: number, y: number, dark: boolean) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    modules[y]![x] = dark;
    reserved[y]![x] = true;
  };

  // The three finder patterns, each with the light separator around it.
  for (const [ox, oy] of [
    [0, 0],
    [size - 7, 0],
    [0, size - 7],
  ] as const) {
    for (let y = -1; y <= 7; y += 1) {
      for (let x = -1; x <= 7; x += 1) {
        const ring = Math.max(Math.abs(x - 3), Math.abs(y - 3));
        set(ox + x, oy + y, x >= 0 && x <= 6 && y >= 0 && y <= 6 && ring !== 2 && ring <= 3);
      }
    }
  }

  // The alignment patterns, except where a finder already is.
  const centres = alignmentCentres[version - 1]!;
  const last = centres[centres.length - 1];
  for (const cy of centres) {
    for (const cx of centres) {
      const atFinder =
        (cx === 6 && cy === 6) || (cx === 6 && cy === last) || (cx === last && cy === 6);
      if (atFinder) continue;
      for (let y = -2; y <= 2; y += 1) {
        for (let x = -2; x <= 2; x += 1) {
          set(cx + x, cy + y, Math.max(Math.abs(x), Math.abs(y)) !== 1);
        }
      }
    }
  }

  // The two timing patterns.
  for (let i = 8; i < size - 8; i += 1) {
    set(i, 6, i % 2 === 0);
    set(6, i, i % 2 === 0);
  }

  // Where the format information goes, written later for the chosen mask. Row 6 and column 6
  // belong to the timing patterns and are stepped over.
  for (let i = 0; i < 9; i += 1) {
    if (i === 6) continue;
    set(i, 8, false);
    set(8, i, false);
  }
  for (let i = 0; i < 8; i += 1) set(size - 1 - i, 8, false);
  for (let i = 0; i < 7; i += 1) set(8, size - 1 - i, false);

  // The one module that is always dark, just above the lower format copy.
  set(8, size - 8, true);
  if (version >= 7) {
    for (let i = 0; i < 18; i += 1) {
      const row = Math.floor(i / 3);
      const column = i % 3;
      set(size - 11 + column, row, false);
      set(row, size - 11 + column, false);
    }
  }
}

// The standard's walk: two columns at a time, right to left, upwards then downwards, skipping the
// column the vertical timing pattern is in.
function placeData(
  modules: (boolean | null)[][],
  reserved: boolean[][],
  codewords: readonly number[],
  remainder: number,
): void {
  const size = modules.length;
  const bits: number[] = [];
  for (const codeword of codewords) {
    for (let i = 7; i >= 0; i -= 1) bits.push((codeword >> i) & 1);
  }
  for (let i = 0; i < remainder; i += 1) bits.push(0);

  let at = 0;
  for (const { right, upwards } of dataColumns(size)) {
    for (let step = 0; step < size; step += 1) {
      const y = upwards ? size - 1 - step : step;
      for (const x of [right, right - 1]) {
        if (reserved[y]![x]) continue;
        modules[y]![x] = (bits[at] ?? 0) === 1;
        at += 1;
      }
    }
  }
}

// The column pairs the walk visits, right to left, alternating direction. The column the vertical
// timing pattern is in is stepped over entirely, so the pairs left of it are 5|4, 3|2, 1|0.
export function dataColumns(size: number): { right: number; upwards: boolean }[] {
  const columns: { right: number; upwards: boolean }[] = [];
  let right = size - 1;
  let upwards = true;
  while (right > 0) {
    columns.push({ right, upwards });
    upwards = !upwards;
    right -= 2;
    if (right === 6) right = 5;
  }
  return columns;
}

// The mask condition: true where the module is flipped.
export function maskBit(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0:
      return (x + y) % 2 === 0;
    case 1:
      return y % 2 === 0;
    case 2:
      return x % 3 === 0;
    case 3:
      return (x + y) % 3 === 0;
    case 4:
      return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
}

// BCH remainder of `value` shifted up by `bits`, for the format and version information.
function bch(value: number, generatorPoly: number, bits: number): number {
  let remainder = value << bits;
  const top = 31 - Math.clz32(generatorPoly);
  for (let i = 31 - Math.clz32(remainder); i >= bits; i -= 1) {
    if ((remainder >> i) & 1) remainder ^= generatorPoly << (i - top);
  }
  return remainder;
}

function drawFormatInformation(modules: boolean[][], mask: number): void {
  const size = modules.length;
  const value = (levelMBits << 3) | mask;
  const format = (((value << 10) | bch(value, 0b10100110111, 10)) ^ 0b101010000010010) >>> 0;
  const bitAt = (i: number) => ((format >> i) & 1) === 1;
  for (let i = 0; i <= 5; i += 1) {
    modules[8]![i] = bitAt(14 - i);
    modules[i]![8] = bitAt(i);
  }
  modules[8]![7] = bitAt(8);
  modules[8]![8] = bitAt(7);
  modules[7]![8] = bitAt(6);
  // The second copy: seven bits up the left edge, eight along the right of row 8.
  for (let i = 0; i <= 6; i += 1) modules[size - 1 - i]![8] = bitAt(i);
  for (let i = 7; i <= 14; i += 1) modules[8]![size - 15 + i] = bitAt(i);
}

function drawVersionInformation(modules: boolean[][], version: number): void {
  const size = modules.length;
  const value = (version << 12) | bch(version, 0b1111100100, 12);
  for (let i = 0; i < 18; i += 1) {
    const bit = ((value >> i) & 1) === 1;
    const row = Math.floor(i / 3);
    const column = i % 3;
    modules[row]![size - 11 + column] = bit;
    modules[size - 11 + column]![row] = bit;
  }
}

// --- Mask penalties (ISO/IEC 18004) ---------------------------------------

function penaltyOf(modules: boolean[][]): number {
  const size = modules.length;
  let penalty = 0;
  const lines: boolean[][] = [];
  for (let i = 0; i < size; i += 1) {
    lines.push(modules[i]!);
    lines.push(modules.map((row) => row[i]!));
  }
  for (const line of lines) {
    let run = 1;
    for (let i = 1; i < size; i += 1) {
      if (line[i] === line[i - 1]) {
        run += 1;
        continue;
      }
      if (run >= 5) penalty += 3 + (run - 5);
      run = 1;
    }
    if (run >= 5) penalty += 3 + (run - 5);
    penalty += 40 * finderLike(line);
  }
  for (let y = 0; y < size - 1; y += 1) {
    for (let x = 0; x < size - 1; x += 1) {
      const first = modules[y]![x];
      if (
        modules[y]![x + 1] === first &&
        modules[y + 1]![x] === first &&
        modules[y + 1]![x + 1] === first
      ) {
        penalty += 3;
      }
    }
  }
  const dark = modules.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
  const percent = (dark * 100) / (size * size);
  penalty += 10 * Math.floor(Math.abs(percent - 50) / 5);
  return penalty;
}

// The 1:1:3:1:1 finder proportion with four light modules on one side, which must not appear
// among the data.
function finderLike(line: readonly boolean[]): number {
  const pattern = [true, false, true, true, true, false, true];
  const light = [false, false, false, false];
  const matches = (at: number, wanted: readonly boolean[]) =>
    wanted.every((value, i) => line[at + i] === value);
  let found = 0;
  for (let i = 0; i + 10 < line.length; i += 1) {
    if (matches(i, pattern) && matches(i + 7, light)) found += 1;
    if (matches(i, light) && matches(i + 4, pattern)) found += 1;
  }
  return found;
}
