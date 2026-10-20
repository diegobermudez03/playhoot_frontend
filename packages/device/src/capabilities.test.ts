import { describe, expect, it } from 'vitest';

import { classifyDisplay } from './capabilities';

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
