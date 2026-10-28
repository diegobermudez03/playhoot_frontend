import { describe, expect, it } from 'vitest';

import { operationAccess, requiredLevel, type OperationCatalog } from './access';
import type { AuthSnapshot } from './auth';

const catalog: OperationCatalog = {
  status: 'ready',
  requirements: new Map([
    ['CREATE_SESSION', 'account'],
    ['JOIN_SESSION_AS_PLAYER', 'guest'],
    ['FUTURE_THING', 'verified'],
  ]),
};
const none: AuthSnapshot = { status: 'none' };
const guest: AuthSnapshot = { status: 'guest', userUUID: 'u', displayName: 'Ana' };
const account: AuthSnapshot = { status: 'authenticated', userUUID: 'u', displayName: 'Ana' };

describe('operationAccess', () => {
  it('sends a person without identity to the weakest authentication the operation allows', () => {
    expect(operationAccess(none, catalog, 'JOIN_SESSION_AS_PLAYER')).toEqual({
      status: 'needs',
      level: 'guest',
    });
    expect(operationAccess(none, catalog, 'CREATE_SESSION')).toEqual({
      status: 'needs',
      level: 'account',
    });
  });

  it('asks a guest for an account only when the operation requires one', () => {
    expect(operationAccess(guest, catalog, 'JOIN_SESSION_AS_PLAYER')).toEqual({
      status: 'allowed',
    });
    expect(operationAccess(guest, catalog, 'CREATE_SESSION')).toEqual({
      status: 'needs',
      level: 'account',
    });
  });

  it('allows an account everything it knows', () => {
    expect(operationAccess(account, catalog, 'CREATE_SESSION')).toEqual({ status: 'allowed' });
    expect(operationAccess(account, catalog, 'JOIN_SESSION_AS_PLAYER')).toEqual({
      status: 'allowed',
    });
  });

  it('waits while the identity or the catalog is unknown', () => {
    expect(operationAccess({ status: 'unknown' }, catalog, 'CREATE_SESSION')).toEqual({
      status: 'pending',
    });
    expect(operationAccess(account, { status: 'loading' }, 'CREATE_SESSION')).toEqual({
      status: 'pending',
    });
  });
});

describe('requiredLevel', () => {
  it('treats an unlisted operation or an unknown level as requiring an account', () => {
    if (catalog.status !== 'ready') throw new Error('catalog');
    expect(requiredLevel(catalog.requirements, 'NOT_LISTED')).toBe('account');
    expect(requiredLevel(catalog.requirements, 'FUTURE_THING')).toBe('account');
    expect(requiredLevel(catalog.requirements, 'JOIN_SESSION_AS_PLAYER')).toBe('guest');
  });
});
