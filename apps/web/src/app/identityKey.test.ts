import { describe, expect, it } from 'vitest';

import { identityKey } from './identityKey';

describe('identityKey', () => {
  it('changes with the person, not with their level or name', () => {
    const guest = identityKey({ status: 'guest', userUUID: 'u-1', displayName: 'Gus' });
    const linked = identityKey({ status: 'authenticated', userUUID: 'u-1', displayName: 'Gus' });
    const other = identityKey({ status: 'authenticated', userUUID: 'u-2', displayName: 'Ana' });

    expect(linked).toBe(guest);
    expect(other).not.toBe(guest);
    expect(identityKey({ status: 'none' })).not.toBe(guest);
    expect(identityKey({ status: 'unknown' })).toBe('unknown');
  });
});
