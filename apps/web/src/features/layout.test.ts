import { describe, expect, it } from 'vitest';

import { selectLayout } from './layout';

describe('selectLayout', () => {
  it('is compact on a phone held upright', () => {
    expect(selectLayout({ orientation: 'portrait', displayClass: 'compact' })).toBe('compact');
  });

  it('is wide on a phone held sideways (a medium, landscape display)', () => {
    expect(selectLayout({ orientation: 'landscape', displayClass: 'medium' })).toBe('wide');
  });

  it('is wide on a desktop window', () => {
    expect(selectLayout({ orientation: 'landscape', displayClass: 'wide' })).toBe('wide');
  });

  it('is compact on a portrait tablet or a tall narrow window', () => {
    expect(selectLayout({ orientation: 'portrait', displayClass: 'medium' })).toBe('compact');
    expect(selectLayout({ orientation: 'portrait', displayClass: 'wide' })).toBe('compact');
  });

  it('is compact on a landscape display too narrow for two columns', () => {
    expect(selectLayout({ orientation: 'landscape', displayClass: 'compact' })).toBe('compact');
  });
});
