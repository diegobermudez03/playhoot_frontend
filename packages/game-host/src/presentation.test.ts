import { describe, expect, it } from 'vitest';

import { presentationFor, samePresentation } from './presentation';
import { fitGameViewport } from './viewport';

const viewport = { aspectRatio: '16:9', width: 1920, height: 1080 };

describe('presentationFor', () => {
  it('describes a phone held sideways: compact, coarse, the notch in logical pixels', () => {
    const fit = fitGameViewport({ width: 800, height: 380 }, viewport);
    const presentation = presentationFor({
      viewport,
      fit,
      gameRect: { left: fit.left, top: fit.top, width: fit.width, height: fit.height },
      window: { width: 800, height: 380 },
      safeInsets: { top: 0, right: 0, bottom: 0, left: 120 },
      pixelRatio: 3,
      coarsePointer: true,
      reducedMotion: true,
      highContrast: false,
    });
    expect(presentation).toMatchObject({
      density: 'compact',
      pointer: 'coarse',
      reducedMotion: true,
      pixelRatio: 3,
    });
    // The game is pillarboxed: 62.2 CSS px of bars on each side, the notch covers 120.
    expect(presentation.safeArea.left).toBeCloseTo((120 - fit.left) / fit.scale, 0);
    expect(presentation.safeArea.right).toBe(0);
  });

  it('describes a large screen with a mouse as spacious and fine', () => {
    const fit = fitGameViewport({ width: 1920, height: 1080 }, viewport);
    const presentation = presentationFor({
      viewport,
      fit,
      gameRect: { left: 0, top: 0, width: 1920, height: 1080 },
      window: { width: 1920, height: 1080 },
      safeInsets: { top: 0, right: 0, bottom: 0, left: 0 },
      pixelRatio: 1,
      coarsePointer: false,
      reducedMotion: false,
      highContrast: false,
    });
    expect(presentation).toMatchObject({ scale: 1, density: 'spacious', pointer: 'fine' });
    expect(samePresentation(presentation, { ...presentation })).toBe(true);
    expect(samePresentation(null, presentation)).toBe(false);
  });
});
