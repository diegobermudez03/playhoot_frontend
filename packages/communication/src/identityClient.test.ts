import { describe, expect, it, vi } from 'vitest';

import { createHttpClient } from './http';
import { createIdentityClient } from './identityClient';

describe('createIdentityClient.createGuest', () => {
  it('posts the guest request without a credential and maps the answer', async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify({ user_uuid: 'u-1', token: 't-1' }), { status: 201 }),
    );
    const identity = createIdentityClient(
      createHttpClient({
        baseUrl: '',
        credentials: { currentToken: () => 'old' },
        fetch: fetchImpl,
      }),
    );

    const result = await identity.createGuest('Ana', 'key-1');

    expect(result).toEqual({ ok: true, value: { userUUID: 'u-1', token: 't-1' } });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('/v1/guests');
    expect(init?.headers).not.toHaveProperty('Authorization');
    expect(JSON.parse(init?.body as string)).toEqual({
      display_name: 'Ana',
      idempotency_key: 'key-1',
    });
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
