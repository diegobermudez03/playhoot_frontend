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
  // What kind of device this is, as the backend checks games against it: a desktop has a keyboard
  // and a mouse, a mobile device only touch. A tablet is whichever the platform says it is.
  deviceClass: DeviceClass;
}

export type DeviceClass = 'desktop' | 'mobile';

// Mobile when the platform says so, or when the primary pointer is a finger that cannot hover;
// a laptop with a touch screen keeps a fine, hovering primary pointer and stays a desktop.
export function classifyDevice(input: {
  platformSaysMobile: boolean | undefined;
  primaryPointerCoarse: boolean;
  primaryPointerHovers: boolean;
}): DeviceClass {
  if (input.platformSaysMobile !== undefined)
    return input.platformSaysMobile ? 'mobile' : 'desktop';
  return input.primaryPointerCoarse && !input.primaryPointerHovers ? 'mobile' : 'desktop';
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
