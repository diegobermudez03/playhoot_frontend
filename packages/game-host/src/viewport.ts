// The fixed shape a GameVersion's frontend is shown in (plan §8): one of the aspect ratios the
// backend offers and its logical resolution. The game always draws in, and receives input in,
// `width` x `height` logical units, whatever the device.
export interface GameViewport {
  aspectRatio: string;
  width: number;
  height: number;
}

// Where the game goes inside the space the presentation gave it, in that space's own pixels.
export interface ViewportFit {
  // Logical units to host pixels. The same on both axes, so the game is never stretched.
  scale: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

// Fits the whole game inside `available`, as large as possible, centered: the unused space
// becomes bars above and below (letterbox) or at the sides (pillarbox). Like an image shown
// whole: only the ratio matters, never the device's pixels.
export function fitGameViewport(
  available: { width: number; height: number },
  viewport: GameViewport,
): ViewportFit {
  const scale = Math.max(
    0,
    Math.min(available.width / viewport.width, available.height / viewport.height),
  );
  const width = viewport.width * scale;
  const height = viewport.height * scale;
  return {
    scale,
    left: (available.width - width) / 2,
    top: (available.height - height) / 2,
    width,
    height,
  };
}

export function viewportOrientation(viewport: GameViewport): 'landscape' | 'portrait' | 'square' {
  if (viewport.width === viewport.height) return 'square';
  return viewport.width > viewport.height ? 'landscape' : 'portrait';
}
