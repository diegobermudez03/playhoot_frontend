import { describe, expect, it, vi } from 'vitest';

import { createHttpClient } from './http';
import { createIdentityClient } from './identityClient';

const credentialsBody = {
  user: { user_uuid: 'u-1', display_name: 'Ana', level: 'guest' },
  access_token: 'a-1',
  access_expires_at: '2026-10-27T12:15:00Z',
  refresh_token: 'r-1',
};
const credential = {
  token: 'a-1',
  refreshToken: 'r-1',
  expiresAt: Date.parse('2026-10-27T12:15:00Z'),
  userUUID: 'u-1',
  kind: 'guest',
  displayName: 'Ana',
};

function identityWith(answer: () => Response) {
  const fetchImpl = vi.fn<typeof fetch>(async () => answer());
  const identity = createIdentityClient(
    createHttpClient({ baseUrl: '', credentials: { currentToken: () => 'old' }, fetch: fetchImpl }),
  );
  return { identity, fetchImpl };
}

describe('createIdentityClient.createGuest', () => {
  it('posts the guest request without a credential and maps the credentials', async () => {
    const t = identityWith(() => new Response(JSON.stringify(credentialsBody), { status: 201 }));

    const result = await t.identity.createGuest('Ana', 'key-1');

    expect(result).toEqual({ ok: true, value: credential });
    const [url, init] = t.fetchImpl.mock.calls[0]!;
    expect(url).toBe('/v1/guests');
    expect(init?.headers).not.toHaveProperty('Authorization');
    expect(JSON.parse(init?.body as string)).toEqual({
      display_name: 'Ana',
      idempotency_key: 'key-1',
    });
  });

  it('counts a level it does not know as a guest', async () => {
    const t = identityWith(
      () =>
        new Response(
          JSON.stringify({
            ...credentialsBody,
            user: { ...credentialsBody.user, level: 'verified' },
          }),
          { status: 201 },
        ),
    );
    const result = await t.identity.createGuest('Ana', 'key-1');
    expect(result).toMatchObject({ ok: true, value: { kind: 'guest' } });
  });
});

describe('createIdentityClient.refresh and logout', () => {
  it('renews with the refresh token alone', async () => {
    const t = identityWith(() => new Response(JSON.stringify(credentialsBody), { status: 200 }));

    const result = await t.identity.refresh('r-1');

    expect(result).toEqual({ ok: true, value: credential });
    const [url, init] = t.fetchImpl.mock.calls[0]!;
    expect(url).toBe('/v1/identity/refresh');
    expect(init?.headers).not.toHaveProperty('Authorization');
    expect(JSON.parse(init?.body as string)).toEqual({ refresh_token: 'r-1' });
  });

  it("times the access token's expiry on this device's clock when the lifetime is sent", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({ ...credentialsBody, access_expires_in: 900 }), {
          status: 200,
        }),
    );
    // This device's clock is a day behind the backend's.
    const identity = createIdentityClient(
      createHttpClient({
        baseUrl: '',
        credentials: { currentToken: () => null },
        fetch: fetchImpl,
      }),
      () => 5_000,
    );

    const result = await identity.refresh('r-1');

    expect(result).toMatchObject({ ok: true, value: { expiresAt: 5_000 + 900_000 } });
  });

  it('reports a refused refresh token with its code', async () => {
    const t = identityWith(
      () =>
        new Response(JSON.stringify({ code: 'refresh_invalid', message: 'no' }), { status: 401 }),
    );
    const result = await t.identity.refresh('r-old');
    expect(result).toMatchObject({ ok: false, error: { status: 401, code: 'refresh_invalid' } });
  });

  it('signs out with the refresh token', async () => {
    const t = identityWith(() => new Response(null, { status: 204 }));
    const result = await t.identity.logout('r-1');
    expect(result).toEqual({ ok: true, value: undefined });
    expect(t.fetchImpl.mock.calls[0]![0]).toBe('/v1/identity/logout');
  });
});

describe('createIdentityClient.listOperations', () => {
  it('reads the catalog without a credential, keeping levels it does not know', async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            operations: [
              { operation: 'CREATE_SESSION', required_level: 'account' },
              { operation: 'FUTURE_THING', required_level: 'verified' },
            ],
          }),
          { status: 200 },
        ),
    );
    const identity = createIdentityClient(
      createHttpClient({ baseUrl: '', credentials: { currentToken: () => 't' }, fetch: fetchImpl }),
    );

    const result = await identity.listOperations();

    expect(result).toEqual({
      ok: true,
      value: [
        { operation: 'CREATE_SESSION', requiredLevel: 'account' },
        { operation: 'FUTURE_THING', requiredLevel: 'verified' },
      ],
    });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('/v1/identity/operations');
    expect(init?.method).toBe('GET');
    expect(init?.headers).not.toHaveProperty('Authorization');
  });
});

describe('createIdentityClient sign-in', () => {
  it('starts a login with the provider and the code challenge', async () => {
    const t = identityWith(
      () =>
        new Response(JSON.stringify({ authorization_url: '/authorize?state=s' }), { status: 200 }),
    );

    const result = await t.identity.startLogin('local', 'challenge');

    expect(result).toEqual({ ok: true, value: '/authorize?state=s' });
    const [url, init] = t.fetchImpl.mock.calls[0]!;
    expect(url).toBe('/v1/identity/login/start');
    expect(init?.headers).not.toHaveProperty('Authorization');
    expect(JSON.parse(init?.body as string)).toEqual({
      provider: 'local',
      code_challenge: 'challenge',
    });
  });

  it('completes a login, naming the session it replaces', async () => {
    const t = identityWith(
      () =>
        new Response(
          JSON.stringify({
            ...credentialsBody,
            user: { ...credentialsBody.user, level: 'account' },
          }),
          { status: 200 },
        ),
    );

    const result = await t.identity.completeLogin('phl_code', 'verifier', 'r-guest');

    expect(result).toMatchObject({ ok: true, value: { kind: 'account', refreshToken: 'r-1' } });
    const [url, init] = t.fetchImpl.mock.calls[0]!;
    expect(url).toBe('/v1/identity/login/complete');
    expect(JSON.parse(init?.body as string)).toEqual({
      code: 'phl_code',
      code_verifier: 'verifier',
      replaces_refresh_token: 'r-guest',
    });
  });

  it('completes a login without a session to replace', async () => {
    const t = identityWith(() => new Response(JSON.stringify(credentialsBody), { status: 200 }));
    await t.identity.completeLogin('phl_code', 'verifier');
    expect(JSON.parse(t.fetchImpl.mock.calls[0]![1]?.body as string)).toEqual({
      code: 'phl_code',
      code_verifier: 'verifier',
    });
  });
});
