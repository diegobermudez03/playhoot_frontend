import { describe, expect, it } from 'vitest';

import { identityKey } from './identityKey';

describe('identityKey', () => {
  it('changes with the person, not with their level, name or mode', () => {
    const guest = identityKey({
      status: 'guest',
      userUUID: 'u-1',
      displayName: 'Gus',
      mode: 'normal',
    });
    const linked = identityKey({
      status: 'authenticated',
      userUUID: 'u-1',
      displayName: 'Gus',
      mode: 'teacher',
    });
    const other = identityKey({
      status: 'authenticated',
      userUUID: 'u-2',
      displayName: 'Ana',
      mode: 'normal',
    });

    expect(linked).toBe(guest);
    expect(other).not.toBe(guest);
    expect(identityKey({ status: 'none' })).not.toBe(guest);
    expect(identityKey({ status: 'unknown' })).toBe('unknown');
  });
});
