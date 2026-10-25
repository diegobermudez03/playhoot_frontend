import { describe, expect, it } from 'vitest';

import { classifyDevice, classifyDisplay } from './capabilities';

describe('classifyDisplay', () => {
  it.each([
    [{ width: 390, height: 844 }, 'portrait', 'compact'],
    [{ width: 844, height: 390 }, 'landscape', 'medium'],
    [{ width: 768, height: 1024 }, 'portrait', 'medium'],
    [{ width: 1440, height: 900 }, 'landscape', 'wide'],
    [{ width: 600, height: 600 }, 'landscape', 'medium'],
  ])('%o is %s / %s', (viewport, orientation, displayClass) => {
    expect(classifyDisplay(viewport)).toEqual({ orientation, displayClass });
  });
});

describe('classifyDevice', () => {
  it.each([
    // The platform's own answer wins.
    [
      { platformSaysMobile: true, primaryPointerCoarse: false, primaryPointerHovers: true },
      'mobile',
    ],
    [
      { platformSaysMobile: false, primaryPointerCoarse: true, primaryPointerHovers: false },
      'desktop',
    ],
    // Otherwise a finger that cannot hover is mobile; a laptop with a touch screen is not.
    [
      { platformSaysMobile: undefined, primaryPointerCoarse: true, primaryPointerHovers: false },
      'mobile',
    ],
    [
      { platformSaysMobile: undefined, primaryPointerCoarse: false, primaryPointerHovers: true },
      'desktop',
    ],
    [
      { platformSaysMobile: undefined, primaryPointerCoarse: true, primaryPointerHovers: true },
      'desktop',
    ],
  ] as const)('%o is %s', (input, expected) => {
    expect(classifyDevice(input)).toBe(expected);
  });
});
