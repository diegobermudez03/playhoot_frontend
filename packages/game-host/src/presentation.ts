import { densityFor, type Presentation } from '@playhoot/protocol/bridge';

import type { GameViewport, ViewportFit } from './viewport';

// What a platform measures to describe how the game is shown (bridge v2): where the scaled game sits
// in the window, the window edges the device covers, and the person's preferences.
export interface PresentationInput {
  viewport: GameViewport;
  fit: ViewportFit;
  // The game's box in window coordinates (CSS pixels), after the fit.
  gameRect: { left: number; top: number; width: number; height: number };
  window: { width: number; height: number };
  // How much of each window edge the device covers (CSS pixels): env(safe-area-inset-*).
  safeInsets: { top: number; right: number; bottom: number; left: number };
  pixelRatio: number;
  coarsePointer: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
}

// The presentation the game gets: its size on screen, how much of it the device covers (in the
// game's own logical pixels), its density and the preferences.
export function presentationFor(input: PresentationInput): Presentation {
  const { fit, gameRect, safeInsets } = input;
  const covered = (inset: number, distance: number) =>
    fit.scale > 0 ? round(Math.max(0, inset - distance) / fit.scale) : 0;
  return {
    scale: round(fit.scale),
    width: round(fit.width),
    height: round(fit.height),
    pixelRatio: input.pixelRatio,
    safeArea: {
      top: covered(safeInsets.top, gameRect.top),
      left: covered(safeInsets.left, gameRect.left),
      bottom: covered(safeInsets.bottom, input.window.height - (gameRect.top + gameRect.height)),
      right: covered(safeInsets.right, input.window.width - (gameRect.left + gameRect.width)),
    },
    density: densityFor(Math.min(fit.width, fit.height)),
    pointer: input.coarsePointer ? 'coarse' : 'fine',
    reducedMotion: input.reducedMotion,
    highContrast: input.highContrast,
  };
}

export function samePresentation(a: Presentation | null, b: Presentation): boolean {
  return a !== null && JSON.stringify(a) === JSON.stringify(b);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
