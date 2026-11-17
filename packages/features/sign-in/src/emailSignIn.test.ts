import { createAppState, type Credential, type CredentialStore } from '@playhoot/app-core';
import type { HttpFailure, IdentityClient } from '@playhoot/communication';
import { describe, expect, it, vi } from 'vitest';

import { createEmailSignIn } from './emailSignIn';

const account: Credential = {
  token: 'a-acc',
  refreshToken: 'r-acc',
  userUUID: 'u-acc',
  kind: 'account',
  displayName: 'Ana',
};

const guest: Credential = {
  token: 'a-guest',
  refreshToken: 'r-guest',
  userUUID: 'u-guest',
  kind: 'guest',
  displayName: 'Paper Cat',
};

const refused = (code: string, status = 400): { ok: false; error: HttpFailure } => ({
  ok: false,
  error: { kind: 'http', status, code, message: 'no', retryAfterSeconds: undefined },
});

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
  const client: IdentityClient = {
    createGuest: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
    listOperations: vi.fn(),
    setDisplayName: vi.fn(),
    listLoginProviders: vi.fn(),
    startLogin: vi.fn(),
    completeLogin: vi.fn(),
    startEmailLogin: vi.fn(async () => ({ ok: true as const, value: undefined })),
    completeEmailLogin: vi.fn(async () => ({ ok: true as const, value: account })),
    startLinkProvider: vi.fn(),
    completeLinkProvider: vi.fn(),
    listSignInMethods: vi.fn(),
    startLinkEmail: vi.fn(),
    completeLinkEmail: vi.fn(),
    removeSignInMethod: vi.fn(),
    ...identity,
  };
  const signIn = createEmailSignIn({ app, identity: client });
  return { app, client, signIn, state: () => signIn.store.getState() };
}

describe('createEmailSignIn', () => {
  it('asks for a code and opens the code step for the address typed', async () => {
    const t = setup();

    expect(await t.signIn.start('  Ana@Example.com  ', 'es')).toBe(true);

    expect(t.client.startEmailLogin).toHaveBeenCalledWith('Ana@Example.com', 'es');
    expect(t.state()).toMatchObject({
      step: 'code',
      address: 'Ana@Example.com',
      resent: false,
      error: null,
    });
  });

  it('refuses a value that is not an address without asking the backend', async () => {
    const t = setup();

    expect(await t.signIn.start('nothing', 'en')).toBe(false);

    expect(t.client.startEmailLogin).not.toHaveBeenCalled();
    expect(t.state()).toMatchObject({ step: 'address', error: { kind: 'invalid-address' } });
  });

  it('reports the backend refusing the address, and a rate limit with its wait', async () => {
    const invalid = setup({ startEmailLogin: vi.fn(async () => refused('invalid_address')) });
    await invalid.signIn.start('a@b.c', 'en');
    expect(invalid.state()).toMatchObject({ step: 'address', error: { kind: 'invalid-address' } });

    const limited = setup({
      startEmailLogin: vi.fn(async () => ({
        ok: false as const,
        error: {
          kind: 'http' as const,
          status: 429,
          code: 'rate_limited',
          message: 'slow down',
          retryAfterSeconds: 60,
        },
      })),
    });
    await limited.signIn.start('a@b.c', 'en');
    expect(limited.state().error).toEqual({ kind: 'rate-limited', retryAfterSeconds: 60 });
  });

  it('asks for another code for the same address and says it superseded the first', async () => {
    const t = setup();
    await t.signIn.start('a@b.c', 'en');

    expect(await t.signIn.resend('en')).toBe(true);

    expect(t.client.startEmailLogin).toHaveBeenCalledTimes(2);
    expect(t.state()).toMatchObject({ step: 'code', address: 'a@b.c', resent: true });
  });

  it('completes with the code and signs the account in, handing over the guest held until now', async () => {
    const t = setup({}, guest);
    await t.signIn.start('a@b.c', 'en');

    expect(await t.signIn.complete('123456')).toBe(true);

    expect(t.client.completeEmailLogin).toHaveBeenCalledWith('a@b.c', '123456', 'r-guest');
    expect(t.app.store.getState().auth).toMatchObject({
      status: 'authenticated',
      userUUID: 'u-acc',
    });
  });

  it('tells a wrong code from one that is no longer live', async () => {
    const wrong = setup({ completeEmailLogin: vi.fn(async () => refused('invalid_code')) });
    await wrong.signIn.start('a@b.c', 'en');
    await wrong.signIn.complete('123456');
    expect(wrong.state()).toMatchObject({ step: 'code', error: { kind: 'wrong-code' } });

    const gone = setup({ completeEmailLogin: vi.fn(async () => refused('attempt_gone', 410)) });
    await gone.signIn.start('a@b.c', 'en');
    await gone.signIn.complete('123456');
    expect(gone.state().error).toEqual({ kind: 'attempt-gone' });
  });

  it('does not send a code of the wrong length to the backend', async () => {
    const t = setup();
    await t.signIn.start('a@b.c', 'en');

    expect(await t.signIn.complete('123')).toBe(false);

    expect(t.client.completeEmailLogin).not.toHaveBeenCalled();
    expect(t.state().error).toEqual({ kind: 'wrong-code' });
  });

  it('goes back to the address without forgetting it', async () => {
    const t = setup();
    await t.signIn.start('a@b.c', 'en');

    t.signIn.editAddress();

    expect(t.state()).toMatchObject({ step: 'address', address: 'a@b.c', error: null });
  });
});
