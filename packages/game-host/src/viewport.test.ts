import { describe, expect, it } from 'vitest';

import { fitGameViewport, viewportOrientation, type GameViewport } from './viewport';

const landscape: GameViewport = { aspectRatio: '16:9', width: 1920, height: 1080 };
const portrait: GameViewport = { aspectRatio: '9:16', width: 1080, height: 1920 };
const square: GameViewport = { aspectRatio: '1:1', width: 1080, height: 1080 };

describe('fitGameViewport', () => {
  it('fills a space of the same ratio exactly', () => {
    expect(fitGameViewport({ width: 960, height: 540 }, landscape)).toEqual({
      scale: 0.5,
      left: 0,
      top: 0,
      width: 960,
      height: 540,
    });
  });

  it('letterboxes a landscape game on a portrait phone: whole, centered, bars above and below', () => {
    const fit = fitGameViewport({ width: 390, height: 700 }, landscape);
    expect(fit.width).toBe(390);
    expect(fit.height).toBeCloseTo(219.375);
    expect(fit.left).toBe(0);
    expect(fit.top).toBeCloseTo((700 - 219.375) / 2);
  });

  it('pillarboxes a portrait game on a wide screen: bars at the sides', () => {
    const fit = fitGameViewport({ width: 1600, height: 900 }, portrait);
    expect(fit.height).toBe(900);
    expect(fit.width).toBeCloseTo(506.25);
    expect(fit.top).toBe(0);
    expect(fit.left).toBeCloseTo((1600 - 506.25) / 2);
  });

  it('never stretches: one scale for both axes, so the shape is the game ratio', () => {
    for (const available of [
      { width: 320, height: 568 },
      { width: 1366, height: 600 },
      { width: 777, height: 333 },
    ]) {
      const fit = fitGameViewport(available, square);
      expect(fit.width).toBeCloseTo(fit.height);
      expect(fit.width).toBeLessThanOrEqual(available.width);
      expect(fit.height).toBeLessThanOrEqual(available.height);
    }
  });

  it('shows nothing in a space with no room', () => {
    expect(fitGameViewport({ width: 0, height: 500 }, landscape).scale).toBe(0);
  });
});

describe('viewportOrientation', () => {
  it('tells landscape, portrait and square apart', () => {
    expect(viewportOrientation(landscape)).toBe('landscape');
    expect(viewportOrientation(portrait)).toBe('portrait');
    expect(viewportOrientation(square)).toBe('square');
  });
});
