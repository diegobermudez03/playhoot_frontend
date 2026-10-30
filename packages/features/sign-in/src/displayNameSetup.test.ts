import { createAppState, type Credential, type CredentialStore } from '@playhoot/app-core';
import type { IdentityClient } from '@playhoot/communication';
import { describe, expect, it, vi } from 'vitest';

import { createDisplayNameSetup } from './displayNameSetup';

const unnamed: Credential = {
  token: 'a-1',
  refreshToken: 'r-1',
  userUUID: 'u-1',
  kind: 'account',
};

function setup(setDisplayName: IdentityClient['setDisplayName']) {
  let saved: Credential | null = unnamed;
  const credentials: CredentialStore = {
    load: () => saved,
    save: (credential) => {
      saved = credential;
    },
    clear: () => {
      saved = null;
    },
  };
  const refresh = vi.fn(async () => ({ kind: 'unavailable' as const }));
  const app = createAppState({
    credentials,
    refresher: { refresh },
    locale: { store: { load: () => null, save: () => undefined }, devicePreferences: () => [] },
  });
  app.bootstrap();
  const identity = { setDisplayName: vi.fn(setDisplayName) } as unknown as IdentityClient;
  const names = createDisplayNameSetup({ app, identity });
  return { app, identity, names, refresh, saved: () => saved };
}

describe('createDisplayNameSetup', () => {
  it('names the account, shows it at once and renews the access token', async () => {
    const t = setup(async () => ({ ok: true, value: 'Ana' }));
    expect(t.app.store.getState().auth).toMatchObject({ displayName: null });

    expect(await t.names.submit('  Ana ')).toBe(true);

    expect(t.identity.setDisplayName).toHaveBeenCalledWith('Ana');
    expect(t.app.store.getState().auth).toMatchObject({
      status: 'authenticated',
      displayName: 'Ana',
    });
    expect(t.saved()?.displayName).toBe('Ana');
    expect(t.refresh).toHaveBeenCalled();
  });

  it('checks the name before asking the backend', async () => {
    const t = setup(async () => ({ ok: true, value: 'x' }));
    expect(await t.names.submit('   ')).toBe(false);
    expect(t.names.store.getState().error).toMatchObject({ kind: 'invalid-name', reason: 'empty' });
    expect(t.identity.setDisplayName).not.toHaveBeenCalled();
  });

  it('tells a refused name from an unreachable backend, and keeps no name', async () => {
    const refused = setup(async () => ({
      ok: false,
      error: {
        kind: 'http',
        status: 400,
        code: 'invalid_display_name',
        message: '',
        retryAfterSeconds: undefined,
      },
    }));
    await refused.names.submit('Ana');
    expect(refused.names.store.getState().error).toMatchObject({
      kind: 'invalid-name',
      reason: 'rejected',
    });

    const down = setup(async () => ({ ok: false, error: { kind: 'network', message: 'down' } }));
    await down.names.submit('Ana');
    expect(down.names.store.getState().error).toEqual({ kind: 'unavailable' });
    expect(down.app.store.getState().auth).toMatchObject({ displayName: null });
  });
});
