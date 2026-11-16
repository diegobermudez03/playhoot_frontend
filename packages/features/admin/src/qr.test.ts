import { describe, expect, it } from 'vitest';

import {
  blocksOf,
  dataColumns,
  encodeQr,
  errorCorrection,
  maskBit,
  qrFunctionModules,
  qrMaxBytes,
  qrVersions,
  type QrMatrix,
} from './qr';

// The encoder is checked by reading the symbol back: the test takes the finished matrix, works
// out the mask from the format information, unmasks it, walks the placement in reverse,
// de-interleaves the blocks, verifies every block's syndromes are zero (which is what a scanner
// does to know the data is intact), and reads the text out. Nothing of the encoder's own tables
// is trusted along the way except the block structure, which the syndrome check would catch.

const field = gf256();

describe('encodeQr', () => {
  const samples = [
    'otpauth://totp/Playhoot:5f1d5b7a-2c3e-4a7f-9c21-0e8f2a1b4d6c?algorithm=SHA1&digits=6&issuer=Playhoot&period=30&secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
    'a',
    'PLAYHOOT',
    'x'.repeat(qrMaxBytes),
    // Non-ASCII, to show the stream is UTF-8 bytes and not characters.
    'ñandú · 日本',
  ];

  it.each(samples)('reads back the text it encoded: %s', (text) => {
    const matrix = encodeQr(text);
    expect(matrix).not.toBeNull();
    expect(readBack(matrix!)).toBe(text);
  });

  it('refuses a text longer than it can draw', () => {
    expect(encodeQr('x'.repeat(qrMaxBytes + 1))).toBeNull();
  });

  it('draws the three finder patterns and the timing lines', () => {
    const { size, modules } = encodeQr('otpauth://totp/Playhoot:abc?secret=JBSWY3DPEHPK3PXP')!;
    for (const [ox, oy] of [
      [0, 0],
      [size - 7, 0],
      [0, size - 7],
    ]) {
      for (let y = 0; y < 7; y += 1) {
        for (let x = 0; x < 7; x += 1) {
          const ring = Math.max(Math.abs(x - 3), Math.abs(y - 3));
          expect(modules[oy! + y]![ox! + x]).toBe(ring !== 2);
        }
      }
    }
    for (let i = 8; i < size - 8; i += 1) {
      expect(modules[6]![i]).toBe(i % 2 === 0);
      expect(modules[i]![6]).toBe(i % 2 === 0);
    }
    // The module that is dark in every symbol.
    expect(modules[size - 8]![8]).toBe(true);
  });

  // The 32 format strings are fixed by the standard; these eight are the level-M ones, masks 0
  // to 7. A symbol whose format bits are not one of them cannot be read by any scanner.
  const levelMFormats = [
    '101010000010010',
    '101000100100101',
    '101111001111100',
    '101101101001011',
    '100010111111001',
    '100000011001110',
    '100111110010111',
    '100101010100000',
  ];

  it.each(samples)('writes one of the standard level-M format strings: %s', (text) => {
    const { modules } = encodeQr(text)!;
    const bits: number[] = [];
    for (let i = 0; i <= 5; i += 1) bits[i] = modules[i]![8] ? 1 : 0;
    bits[6] = modules[7]![8] ? 1 : 0;
    bits[7] = modules[8]![8] ? 1 : 0;
    bits[8] = modules[8]![7] ? 1 : 0;
    for (let i = 9; i <= 14; i += 1) bits[i] = modules[8]![14 - i] ? 1 : 0;
    // The string is written most significant bit first.
    expect(levelMFormats).toContain([...bits].reverse().join(''));
  });

  it('is deterministic', () => {
    const text = 'otpauth://totp/Playhoot:same?secret=JBSWY3DPEHPK3PXP';
    expect(encodeQr(text)).toEqual(encodeQr(text));
  });
});

describe('errorCorrection', () => {
  it('produces a codeword the generator polynomial divides exactly', () => {
    // A block plus its parity, read as a polynomial, is zero at the generator's roots. That is
    // the property a scanner relies on, and it does not depend on any table written here.
    const block = Array.from({ length: 16 }, (_, i) => (i * 37 + 5) % 256);
    const parity = errorCorrection(block, 10);
    expect(parity).toHaveLength(10);
    expect(syndromes([...block, ...parity], 10)).toEqual(new Array(10).fill(0));
  });
});

// --- Reading a finished symbol back ---------------------------------------

function readBack(matrix: QrMatrix): string {
  const version = (matrix.size - 17) / 4;
  const mask = maskFromFormat(matrix);
  const reserved = qrFunctionModules(version);
  const unmasked = matrix.modules.map((row, y) =>
    row.map((dark, x) => (reserved[y]![x] ? dark : dark !== maskBit(mask, x, y))),
  );

  const bits = readPlacement(unmasked, reserved);
  const codewords: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    codewords.push(bits.slice(i, i + 8).reduce((value, bit) => (value << 1) | bit, 0));
  }

  const { ec, groups } = qrVersions[version - 1]!;
  const sizes = groups.flatMap(([count, size]) => new Array<number>(count).fill(size));
  const data = deinterleave(codewords, sizes, ec);
  data.forEach(({ block, parity }) => {
    expect(syndromes([...block, ...parity], ec)).toEqual(new Array(ec).fill(0));
  });

  const stream = data.flatMap(({ block }) => block);
  const header = version < 10 ? 8 : 16;
  const mode = stream[0]! >> 4;
  expect(mode).toBe(0b0100);
  const bitsOf = stream.flatMap((byte) => [...Array(8).keys()].map((i) => (byte >> (7 - i)) & 1));
  const length = bitsOf.slice(4, 4 + header).reduce((value, bit) => (value << 1) | bit, 0);
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) {
    bytes[i] = bitsOf
      .slice(4 + header + i * 8, 12 + header + i * 8)
      .reduce((value, bit) => (value << 1) | bit, 0);
  }
  return new TextDecoder().decode(bytes);
}

// The mask, read from the format information around the top-left finder and checked against its
// own BCH code.
function maskFromFormat(matrix: QrMatrix): number {
  const { modules } = matrix;
  const bits: number[] = [];
  for (let i = 0; i <= 5; i += 1) bits[i] = modules[i]![8] ? 1 : 0;
  bits[6] = modules[7]![8] ? 1 : 0;
  bits[7] = modules[8]![8] ? 1 : 0;
  bits[8] = modules[8]![7] ? 1 : 0;
  for (let i = 9; i <= 14; i += 1) bits[i] = modules[8]![14 - i] ? 1 : 0;
  const format = bits.reduce((value, bit, i) => value | (bit << i), 0) ^ 0b101010000010010;
  // The 15 bits are a BCH(15,5) codeword: dividing by its generator leaves nothing.
  let remainder = format;
  for (let i = 14; i >= 10; i -= 1) {
    if ((remainder >> i) & 1) remainder ^= 0b10100110111 << (i - 10);
  }
  expect(remainder).toBe(0);
  // Level M is 00; the three low bits are the mask.
  expect(format >> 13).toBe(0b00);
  return (format >> 10) & 0b111;
}

function readPlacement(modules: boolean[][], reserved: boolean[][]): number[] {
  const size = modules.length;
  const bits: number[] = [];
  for (const { right, upwards } of dataColumns(size)) {
    for (let step = 0; step < size; step += 1) {
      const y = upwards ? size - 1 - step : step;
      for (const x of [right, right - 1]) {
        if (reserved[y]![x]) continue;
        bits.push(modules[y]![x] ? 1 : 0);
      }
    }
  }
  return bits;
}

function deinterleave(
  codewords: readonly number[],
  sizes: readonly number[],
  ec: number,
): { block: number[]; parity: number[] }[] {
  const blocks = sizes.map(() => [] as number[]);
  const parities = sizes.map(() => [] as number[]);
  let at = 0;
  for (let i = 0; i < Math.max(...sizes); i += 1) {
    sizes.forEach((size, index) => {
      if (i < size) blocks[index]!.push(codewords[at++]!);
    });
  }
  for (let i = 0; i < ec; i += 1) {
    sizes.forEach((_, index) => parities[index]!.push(codewords[at++]!));
  }
  return blocks.map((block, index) => ({ block, parity: parities[index]! }));
}

// The syndromes of a codeword: its value at each root of the generator polynomial. All zero means
// the codeword is intact, which is what makes the Reed-Solomon parity correct.
function syndromes(codeword: readonly number[], count: number): number[] {
  return Array.from({ length: count }, (_, i) =>
    codeword.reduce((value, byte) => field.multiply(value, field.exp(i)) ^ byte, 0),
  );
}

// GF(256) built here, independently of the encoder's own table.
function gf256() {
  const exp: number[] = [];
  const log: number[] = new Array(256).fill(0);
  let value = 1;
  for (let i = 0; i < 255; i += 1) {
    exp.push(value);
    log[value] = i;
    value <<= 1;
    if (value & 0x100) value ^= 0x11d;
  }
  return {
    exp: (power: number) => exp[power % 255]!,
    multiply: (a: number, b: number) => (a === 0 || b === 0 ? 0 : exp[(log[a]! + log[b]!) % 255]!),
  };
}

// The block structure the encoder cuts the data into is used by the reader above; this keeps the
// two in step if a version is ever added.
describe('blocksOf', () => {
  it('cuts the data into the version block sizes', () => {
    const version = 8;
    const total = qrVersions[version - 1]!.groups.reduce((sum, [n, size]) => sum + n * size, 0);
    const blocks = blocksOf(version, new Array<number>(total).fill(0));
    expect(blocks.map((block) => block.length)).toEqual([38, 38, 39, 39]);
  });
});
