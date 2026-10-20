// What the current device can do, modeled as capabilities, never as device brands (plan §7).
export interface DeviceCapabilities {
  touch: boolean;
  // Best effort: browsers cannot detect a keyboard; platform adapters document their heuristic.
  keyboard: boolean;
  // Finest pointer available: `fine` (mouse/trackpad), `coarse` (finger), `none`.
  pointer: 'fine' | 'coarse' | 'none';
  gamepad: boolean;
  viewport: { width: number; height: number };
  orientation: Orientation;
  displayClass: DisplayClass;
}

export type Orientation = 'portrait' | 'landscape';
export type DisplayClass = 'compact' | 'medium' | 'wide';

// Width breakpoints (CSS px) between display classes. Presentation picks variants from the class.
export const displayClassBreakpoints = { medium: 600, wide: 1024 } as const;

export function classifyDisplay(viewport: { width: number; height: number }): {
  orientation: Orientation;
  displayClass: DisplayClass;
} {
  const orientation: Orientation = viewport.width >= viewport.height ? 'landscape' : 'portrait';
  const displayClass: DisplayClass =
    viewport.width >= displayClassBreakpoints.wide
      ? 'wide'
      : viewport.width >= displayClassBreakpoints.medium
        ? 'medium'
        : 'compact';
  return { orientation, displayClass };
}
