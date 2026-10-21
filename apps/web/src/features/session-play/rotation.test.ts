import { describe, expect, it } from 'vitest';

import { suggestsRotation } from './rotation';

const landscape = { aspectRatio: '16:9', width: 1920, height: 1080 };
const portrait = { aspectRatio: '9:16', width: 1080, height: 1920 };
const square = { aspectRatio: '1:1', width: 1080, height: 1080 };
const phone = { touch: true, displayClass: 'compact', orientation: 'portrait' } as const;

describe('suggestsRotation', () => {
  it('suggests turning a portrait phone for a landscape game', () => {
    expect(suggestsRotation(phone, landscape)).toBe(true);
  });

  it('suggests turning a landscape phone for a portrait game', () => {
    expect(suggestsRotation({ ...phone, orientation: 'landscape' }, portrait)).toBe(true);
  });

  it('does not when the device is already held like the game', () => {
    expect(suggestsRotation(phone, portrait)).toBe(false);
  });

  it('never for a square game', () => {
    expect(suggestsRotation(phone, square)).toBe(false);
  });

  it('never without touch or on a wide screen', () => {
    expect(suggestsRotation({ ...phone, touch: false }, landscape)).toBe(false);
    expect(suggestsRotation({ ...phone, displayClass: 'wide' }, landscape)).toBe(false);
  });

  it('also on a medium touch screen (a tablet held the other way)', () => {
    expect(suggestsRotation({ ...phone, displayClass: 'medium' }, landscape)).toBe(true);
  });
});
