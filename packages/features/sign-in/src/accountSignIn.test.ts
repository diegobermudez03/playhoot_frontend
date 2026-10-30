import { createAppState, type Credential, type CredentialStore } from '@playhoot/app-core';
import type { IdentityClient } from '@playhoot/communication';
import { describe, expect, it, vi } from 'vitest';

import { createAccountSignIn, type PendingLogin, type PendingLoginStore } from './accountSignIn';

const account: Credential = {
  token: 'a-acc',
  refreshToken: 'r-acc',
  userUUID: 'u-acc',
  kind: 'account',
  displayName: 'Ana',
};

function setup(identity: Partial<IdentityClient> = {}, signedIn: Credential | null = null) {
  let saved: Credential | null = signedIn;
  const credentials: CredentialStore = {
    load: () => saved,
    save: (credential) => {
      saved = credential;
    },
    clear: () => {
      saved = null;
    },
  };
  const app = createAppState({
    credentials,
    locale: { store: { load: () => null, save: () => undefined }, devicePreferences: () => [] },
  });
  app.bootstrap();
  let kept: PendingLogin | null = null;
  const pending: PendingLoginStore = {
    save: (value) => {
      kept = value;
    },
    take: () => {
      const value = kept;
      kept = null;
      return value;
    },
  };
  const client: IdentityClient = {
    createGuest: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
    listOperations: vi.fn(),
    setDisplayName: vi.fn(),
    startLogin: vi.fn(async () => ({ ok: true as const, value: '/authorize?state=s' })),
    completeLogin: vi.fn(async () => ({ ok: true as const, value: account })),
    ...identity,
  };
  const leaveTo = vi.fn();
  let clock = 1_000;
  const signIn = createAccountSignIn({
    app,
    identity: client,
    pending,
    newVerifier: () => 'verifier',
    challengeOf: async (verifier) => `challenge-of-${verifier}`,
    leaveTo,
    now: () => clock,
  });
  return {
    app,
    client,
    signIn,
    leaveTo,
    pendingNow: () => kept,
    advance: (ms: number) => (clock += ms),
    state: () => signIn.store.getState(),
  };
}

describe('createAccountSignIn', () => {
  it('keeps the verifier and where to go, then leaves for the provider', async () => {
    const t = setup();

    await t.signIn.start('local', '/sessions/new');

    expect(t.client.startLogin).toHaveBeenCalledWith('local', 'challenge-of-verifier');
    expect(t.pendingNow()).toEqual({
      verifier: 'verifier',
      next: '/sessions/new',
      startedAt: 1_000,
    });
    expect(t.leaveTo).toHaveBeenCalledWith('/authorize?state=s');
    expect(t.state().status).toBe('leaving');
  });

  it('completes with the code and the kept verifier, and continues where it was going', async () => {
    const t = setup();
    await t.signIn.start('local', '/sessions/new');

    const done = await t.signIn.complete({ code: 'phl_code', error: null });

    expect(done).toEqual({ next: '/sessions/new' });
    expect(t.client.completeLogin).toHaveBeenCalledWith('phl_code', 'verifier', undefined);
    expect(t.app.store.getState().auth).toMatchObject({
      status: 'authenticated',
      userUUID: 'u-acc',
    });
    expect(t.pendingNow()).toBeNull();
  });

  it('hands over the guest held until now, so its session ends', async () => {
    const guest: Credential = {
      token: 'g',
      refreshToken: 'r-guest',
      userUUID: 'u-g',
      kind: 'guest',
    };
    const t = setup({}, guest);
    t.app.signIn(guest);
    await t.signIn.start('local', null);

    await t.signIn.complete({ code: 'phl_code', error: null });

    expect(t.client.completeLogin).toHaveBeenCalledWith('phl_code', 'verifier', 'r-guest');
    expect(t.app.store.getState().auth).toMatchObject({ status: 'authenticated' });
  });

  it('keeps the guest when the person declined at the provider', async () => {
    const guest: Credential = {
      token: 'g',
      refreshToken: 'r-guest',
      userUUID: 'u-g',
      kind: 'guest',
    };
    const t = setup({}, guest);
    t.app.signIn(guest);
    await t.signIn.start('local', null);

    expect(await t.signIn.complete({ code: null, error: 'cancelled' })).toBe(false);

    expect(t.state()).toEqual({ status: 'failed', error: { kind: 'cancelled' } });
    expect(t.client.completeLogin).not.toHaveBeenCalled();
    expect(t.app.store.getState().auth).toMatchObject({ status: 'guest' });
    expect(t.pendingNow()).toBeNull();
  });

  it('fails without a sign-in started in this tab, or one too old', async () => {
    const t = setup();
    expect(await t.signIn.complete({ code: 'phl_code', error: null })).toBe(false);
    expect(t.state().error).toEqual({ kind: 'failed' });

    await t.signIn.start('local', null);
    t.advance(11 * 60_000);
    expect(await t.signIn.complete({ code: 'phl_code', error: null })).toBe(false);
    expect(t.client.completeLogin).not.toHaveBeenCalled();
  });

  it('tells an unreachable backend apart from a code that no longer works', async () => {
    const down = setup({
      completeLogin: vi.fn(async () => ({
        ok: false as const,
        error: { kind: 'network' as const, message: 'down' },
      })),
    });
    await down.signIn.start('local', null);
    await down.signIn.complete({ code: 'phl_code', error: null });
    expect(down.state().error).toEqual({ kind: 'unavailable' });

    const used = setup({
      completeLogin: vi.fn(async () => ({
        ok: false as const,
        error: {
          kind: 'http' as const,
          status: 400,
          code: 'login_code_invalid',
          message: '',
          retryAfterSeconds: undefined,
        },
      })),
    });
    await used.signIn.start('local', null);
    await used.signIn.complete({ code: 'phl_code', error: null });
    expect(used.state().error).toEqual({ kind: 'failed' });
  });

  it('reports a provider this backend does not offer, and keeps nothing pending', async () => {
    const t = setup({
      startLogin: vi.fn(async () => ({
        ok: false as const,
        error: {
          kind: 'http' as const,
          status: 400,
          code: 'provider_unavailable',
          message: '',
          retryAfterSeconds: undefined,
        },
      })),
    });

    await t.signIn.start('google', null);

    expect(t.state()).toEqual({ status: 'failed', error: { kind: 'provider-unavailable' } });
    expect(t.leaveTo).not.toHaveBeenCalled();
    expect(t.pendingNow()).toBeNull();
  });
});
