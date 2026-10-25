import { describe, expect, it, vi } from 'vitest';

import { createHttpClient, type Decoder } from './http';

const anyObject: Decoder<{ value: number }> = {
  safeParse: (v) =>
    typeof v === 'object' && v !== null && typeof (v as { value?: unknown }).value === 'number'
      ? { success: true, data: v as { value: number } }
      : { success: false, error: 'bad' },
};

function json(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(body === undefined ? '' : JSON.stringify(body), { status, headers });
}

function client(
  fetchImpl: typeof fetch,
  token: string | null = 'tok',
  onCredentialRejected = vi.fn(),
) {
  return {
    onCredentialRejected,
    http: createHttpClient({
      baseUrl: 'http://api',
      credentials: { currentToken: () => token },
      onCredentialRejected,
      fetch: fetchImpl,
    }),
  };
}

describe('createHttpClient', () => {
  it('attaches the current credential and decodes the body', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json(200, { value: 7 }));
    const { http } = client(fetchImpl);

    const result = await http.request({
      method: 'POST',
      path: '/v1/x',
      body: { a: 1 },
      response: anyObject,
    });

    expect(result).toEqual({ ok: true, value: { value: 7 } });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('http://api/v1/x');
    expect(init?.headers).toMatchObject({
      Authorization: 'Bearer tok',
      'Content-Type': 'application/json',
    });
    expect(init?.body).toBe('{"a":1}');
  });

  it('does not attach a credential to unauthenticated requests', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json(200, { value: 1 }));
    const { http } = client(fetchImpl);

    await http.request({ method: 'GET', path: '/v1/x', response: anyObject, authenticated: false });

    expect(fetchImpl.mock.calls[0]![1]?.headers).not.toHaveProperty('Authorization');
  });

  it('maps backend errors with their code and Retry-After', async () => {
    const { http } = client(async () =>
      json(429, { code: 'rate_limited', message: 'slow down' }, { 'Retry-After': '3' }),
    );

    const result = await http.request({ method: 'GET', path: '/v1/x', response: anyObject });

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'http',
        status: 429,
        code: 'rate_limited',
        message: 'slow down',
        retryAfterSeconds: 3,
      },
    });
  });

  it('reports a rejected credential only for token_invalid on an authenticated request', async () => {
    const invalid = client(async () => json(401, { code: 'token_invalid', message: 'nope' }));
    await invalid.http.request({ method: 'GET', path: '/v1/x', response: anyObject });
    expect(invalid.onCredentialRejected).toHaveBeenCalledOnce();

    const forbidden = client(async () => json(403, { code: 'operation_forbidden', message: 'no' }));
    await forbidden.http.request({ method: 'GET', path: '/v1/x', response: anyObject });
    expect(forbidden.onCredentialRejected).not.toHaveBeenCalled();
  });

  it('renews a refused credential once and sends the request again with the new token', async () => {
    let token = 'old';
    const sent: (string | null)[] = [];
    const onCredentialRejected = vi.fn();
    const refresh = vi.fn(() => {
      token = 'new';
      return Promise.resolve(true);
    });
    const http = createHttpClient({
      baseUrl: 'http://api',
      credentials: { currentToken: () => token, refresh },
      onCredentialRejected,
      fetch: (_input, init) => {
        const auth = new Headers(init?.headers).get('Authorization');
        sent.push(auth);
        return Promise.resolve(
          auth === 'Bearer new'
            ? json(200, { value: 1 })
            : json(401, { code: 'token_invalid', message: 'expired' }),
        );
      },
    });
    const result = await http.request({ method: 'GET', path: '/x', response: anyObject });
    expect(result).toEqual({ ok: true, value: { value: 1 } });
    expect(sent).toEqual(['Bearer old', 'Bearer new']);
    expect(refresh).toHaveBeenCalledOnce();
    expect(onCredentialRejected).not.toHaveBeenCalled();
  });

  it('forgets the credential when it cannot be renewed, or is refused again after renewing', async () => {
    const refused = () => Promise.resolve(json(401, { code: 'token_invalid', message: 'no' }));
    for (const renewed of [false, true]) {
      const onCredentialRejected = vi.fn();
      const refresh = vi.fn(() => Promise.resolve(renewed));
      const http = createHttpClient({
        baseUrl: 'http://api',
        credentials: { currentToken: () => 'tok', refresh },
        onCredentialRejected,
        fetch: refused,
      });
      const result = await http.request({ method: 'GET', path: '/x', response: anyObject });
      expect(result.ok).toBe(false);
      expect(refresh).toHaveBeenCalledOnce();
      expect(onCredentialRejected).toHaveBeenCalledOnce();
    }
  });

  it('separates network failures and contract violations', async () => {
    const offline = client(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(
      await offline.http.request({ method: 'GET', path: '/v1/x', response: anyObject }),
    ).toEqual({
      ok: false,
      error: { kind: 'network', message: 'Failed to fetch' },
    });

    const wrongShape = client(async () => json(200, { other: true }));
    const result = await wrongShape.http.request({
      method: 'GET',
      path: '/v1/x',
      response: anyObject,
    });
    expect(result.ok === false && result.error.kind).toBe('decode');
  });

  it('keeps the status text when an error body is not the backend shape', async () => {
    const { http } = client(
      async () => new Response('<html>', { status: 502, statusText: 'Bad Gateway' }),
    );
    const result = await http.request({ method: 'GET', path: '/v1/x', response: anyObject });
    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'http',
        status: 502,
        code: undefined,
        message: 'Bad Gateway',
        retryAfterSeconds: undefined,
      },
    });
  });
});
