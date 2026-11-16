import { describe, expect, it } from 'vitest';

import { authPath, authRequest, joinCodeOf, safeNext } from './paths';

const origin = 'https://playhoot.example';

describe('the authentication screen address', () => {
  it('carries the reason, the level, the account choice and where to continue', () => {
    expect(authPath()).toBe('/sign-in');
    // The defaults are left out: an account is required and no reason was given.
    expect(authPath({ reason: 'sign-in', level: 'account' })).toBe('/sign-in');
    expect(authPath({ reason: 'join-session', level: 'guest', next: '/join/ABC234' })).toBe(
      '/sign-in?reason=join-session&level=guest&next=%2Fjoin%2FABC234',
    );
    expect(authPath({ reason: 'create-game', account: true })).toBe(
      '/sign-in?reason=create-game&use=account',
    );
  });

  it('reads the same request back from the address', () => {
    expect(authRequest('?reason=join-session&level=guest&next=%2Fjoin%2FABC234', origin)).toEqual({
      reason: 'join-session',
      level: 'guest',
      account: false,
      next: '/join/ABC234',
    });
    expect(authRequest('?use=account&level=guest', origin)).toEqual({
      reason: 'sign-in',
      level: 'guest',
      account: true,
      next: null,
    });
  });

  it('falls back to the strictest reading of an address it does not understand', () => {
    // An unknown reason is no reason, and anything but an explicit `guest` asks for an account.
    expect(authRequest('?reason=something-else&level=anonymous', origin)).toEqual({
      reason: 'sign-in',
      level: 'account',
      account: false,
      next: null,
    });
  });

  it('accepts only paths of this app as next', () => {
    expect(safeNext('?next=%2Fjoin%2FABC234', origin)).toBe('/join/ABC234');
    expect(safeNext('?next=%2Fsessions%2Fs-1%2Fplay%3Fx%3D1', origin)).toBe(
      '/sessions/s-1/play?x=1',
    );
    expect(safeNext('', origin)).toBeNull();
    expect(safeNext('?next=https%3A%2F%2Fevil.example', origin)).toBeNull();
    expect(safeNext('?next=%2F%2Fevil.example', origin)).toBeNull();
    expect(safeNext('?next=%2F%5Cevil.example', origin)).toBeNull();
    expect(safeNext('?next=%2F%09%2Fevil.example', origin)).toBeNull();
    expect(safeNext('?next=%2Fa%0Ab', origin)).toBeNull();
  });

  it('finds the join code a next opens', () => {
    expect(joinCodeOf('/join/abc234')).toBe('ABC234');
    expect(joinCodeOf('/sessions/s-1/play')).toBeNull();
    expect(joinCodeOf(null)).toBeNull();
  });
});
