import { createAppState, type Credential, type CredentialStore } from '@playhoot/app-core';
import type { IdentityClient } from '@playhoot/communication';
import { describe, expect, it, vi } from 'vitest';

import { createGuestSignIn, type SignInTelemetry } from './guestSignIn';

function setup(createGuest: IdentityClient['createGuest']) {
  let saved: Credential | null = null;
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
  const identity: IdentityClient = {
    createGuest: vi.fn(createGuest),
    listOperations: vi.fn(),
  };
  let keys = 0;
  const telemetry: SignInTelemetry[] = [];
  const signIn = createGuestSignIn({
    app,
    identity,
    newIdempotencyKey: () => `key-${++keys}`,
    onTelemetry: (event) => telemetry.push(event),
  });
  return { app, identity, signIn, telemetry, state: () => signIn.store.getState() };
}

const created = async () => ({ ok: true as const, value: { userUUID: 'u-1', token: 'g' } });

describe('createGuestSignIn', () => {
  it('creates a guest with the trimmed name and signs in as them', async () => {
    const t = setup(created);

    expect(await t.signIn.submit('  Ana  ')).toBe(true);

    expect(t.identity.createGuest).toHaveBeenCalledWith('Ana', 'key-1');
    expect(t.app.store.getState().auth).toEqual({
      status: 'guest',
      userUUID: 'u-1',
      displayName: 'Ana',
    });
    expect(t.state()).toEqual({ submitting: false, error: null });
  });

  it('rejects an empty or too long name locally', async () => {
    const t = setup(created);

    expect(await t.signIn.submit('   ')).toBe(false);
    expect(t.state().error).toEqual({ kind: 'invalid-name', reason: 'empty', maxLength: 64 });
    expect(await t.signIn.submit('ñ'.repeat(65))).toBe(false);
    expect(t.state().error).toMatchObject({ kind: 'invalid-name', reason: 'too-long' });
    expect(t.identity.createGuest).not.toHaveBeenCalled();
  });

  it('reuses the idempotency key when the same name is retried, and not for another name', async () => {
    const t = setup(async () => ({ ok: false, error: { kind: 'network', message: 'down' } }));

    await t.signIn.submit('Ana');
    await t.signIn.submit('Ana');
    await t.signIn.submit('Bea');

    expect(vi.mocked(t.identity.createGuest).mock.calls.map((call) => call[1])).toEqual([
      'key-1',
      'key-1',
      'key-2',
    ]);
    expect(t.state().error).toEqual({ kind: 'unavailable' });
    expect(t.telemetry).toContainEqual({ type: 'identity-failed', error: { kind: 'unavailable' } });
  });

  it('tells a name the backend refused and a rate limit apart', async () => {
    const refused = setup(async () => ({
      ok: false,
      error: {
        kind: 'http',
        status: 400,
        code: undefined,
        message: 'bad',
        retryAfterSeconds: undefined,
      },
    }));
    await refused.signIn.submit('Ana');
    expect(refused.state().error).toMatchObject({ kind: 'invalid-name', reason: 'rejected' });

    const limited = setup(async () => ({
      ok: false,
      error: {
        kind: 'http',
        status: 429,
        code: 'rate_limited',
        retryAfterSeconds: 7,
        message: 'slow down',
      },
    }));
    await limited.signIn.submit('Ana');
    expect(limited.state().error).toEqual({ kind: 'rate-limited', retryAfterSeconds: 7 });
  });

  it('never replaces an account signed into while the guest was being created', async () => {
    let answer: (value: Awaited<ReturnType<typeof created>>) => void = () => undefined;
    const t = setup(() => new Promise((resolve) => (answer = resolve)));

    const submitted = t.signIn.submit('Ana');
    t.app.signIn({ token: 'a', userUUID: 'acc', kind: 'account', displayName: 'Test user 1' });
    answer({ ok: true, value: { userUUID: 'u-1', token: 'g' } });

    expect(await submitted).toBe(false);
    expect(t.app.store.getState().auth).toMatchObject({ status: 'authenticated', userUUID: 'acc' });
  });
});
