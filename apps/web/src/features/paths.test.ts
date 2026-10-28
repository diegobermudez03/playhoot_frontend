import { describe, expect, it } from 'vitest';

import { guestSignInPath, joinCodeOf, safeNext, signInPath } from './paths';

describe('sign-in paths', () => {
  it('carries where to continue, encoded', () => {
    expect(guestSignInPath('/join/ABC234')).toBe('/sign-in/guest?next=%2Fjoin%2FABC234');
    expect(signInPath()).toBe('/sign-in');
  });

  it('accepts only paths of this app as next', () => {
    expect(safeNext('?next=%2Fjoin%2FABC234')).toBe('/join/ABC234');
    expect(safeNext('?next=%2Fsessions%2Fs-1%2Fplay%3Fx%3D1')).toBe('/sessions/s-1/play?x=1');
    expect(safeNext('')).toBeNull();
    expect(safeNext('?next=https%3A%2F%2Fevil.example')).toBeNull();
    expect(safeNext('?next=%2F%2Fevil.example')).toBeNull();
    expect(safeNext('?next=%2F%5Cevil.example')).toBeNull();
  });

  it('finds the join code a next opens', () => {
    expect(joinCodeOf('/join/abc234')).toBe('ABC234');
    expect(joinCodeOf('/sessions/s-1/play')).toBeNull();
    expect(joinCodeOf(null)).toBeNull();
  });
});
