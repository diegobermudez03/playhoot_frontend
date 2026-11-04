import { describe, expect, it, vi } from 'vitest';

import { createAiAccessClient } from './aiAccessClient';
import { createGamesClient } from './gamesClient';
import { createHttpClient } from './http';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

function http(answer: (url: string, init?: RequestInit) => Response) {
  const fetchImpl = vi.fn<typeof fetch>(async (url, init) => answer(String(url), init));
  return {
    client: createHttpClient({
      baseUrl: '',
      credentials: { currentToken: () => 't-1' },
      fetch: fetchImpl,
    }),
    fetchImpl,
  };
}

describe('createAiAccessClient', () => {
  it('reads an authorization request and answers where to go after deciding', async () => {
    const { client, fetchImpl } = http((url) =>
      url.endsWith('/approve') || url.endsWith('/deny')
        ? json(200, { redirect_url: 'https://claude.ai/callback?code=x' })
        : json(200, {
            client_name: 'Claude',
            redirect_host: 'claude.ai',
            scopes: ['games'],
            expires_at: '2026-11-03T10:10:00Z',
          }),
    );
    const access = createAiAccessClient(client);

    expect(await access.readAuthorization('r 1')).toEqual({
      ok: true,
      value: {
        clientName: 'Claude',
        clientUri: null,
        redirectHost: 'claude.ai',
        scopes: ['games'],
        expiresAt: '2026-11-03T10:10:00Z',
      },
    });
    expect(String(fetchImpl.mock.calls[0]![0])).toBe('/v1/ai-authorizations/r%201');

    expect(await access.approveAuthorization('r1')).toEqual({
      ok: true,
      value: 'https://claude.ai/callback?code=x',
    });
    expect(await access.denyAuthorization('r1')).toEqual({
      ok: true,
      value: 'https://claude.ai/callback?code=x',
    });
    expect(fetchImpl.mock.calls.map(([url, init]) => [String(url), init?.method])).toEqual([
      ['/v1/ai-authorizations/r%201', 'GET'],
      ['/v1/ai-authorizations/r1/approve', 'POST'],
      ['/v1/ai-authorizations/r1/deny', 'POST'],
    ]);
  });

  it('tells an unknown, expired or used request apart from an unavailable backend', async () => {
    const notFound = createAiAccessClient(http(() => json(404, { error: 'not found' })).client);
    expect(await notFound.readAuthorization('r1')).toEqual({
      ok: false,
      error: { kind: 'not-found' },
    });
    const down = createAiAccessClient(http(() => json(500, { error: 'boom' })).client);
    const answer = await down.approveAuthorization('r1');
    expect(answer.ok).toBe(false);
    if (!answer.ok) expect(answer.error.kind).toBe('unavailable');
  });

  it('lists the connected apps and revokes one', async () => {
    const { client, fetchImpl } = http((url) =>
      url.endsWith('/revoke')
        ? new Response(null, { status: 204 })
        : json(200, [
            {
              connection_id: 'c-1',
              client_name: 'ChatGPT',
              created_at: '2026-11-01T10:00:00Z',
              last_used_at: null,
            },
          ]),
    );
    const access = createAiAccessClient(client);
    expect(await access.listConnections()).toEqual({
      ok: true,
      value: [
        {
          connectionID: 'c-1',
          clientName: 'ChatGPT',
          createdAt: '2026-11-01T10:00:00Z',
          lastUsedAt: null,
        },
      ],
    });
    expect(await access.revokeConnection('c-1')).toEqual({ ok: true, value: undefined });
    expect(String(fetchImpl.mock.calls[1]![0])).toBe('/v1/ai-connections/c-1/revoke');
  });
});

describe('GamesClient.listGames', () => {
  it("lists the caller's games", async () => {
    const { client } = http(() =>
      json(200, [
        {
          game_uuid: 'g-1',
          name: 'Quiz',
          published: true,
          visibility: 'public',
          editing: false,
          publishing: false,
          updated_at: '2026-11-02T10:00:00Z',
        },
      ]),
    );
    expect(await createGamesClient(client).listGames()).toEqual({
      ok: true,
      value: [
        {
          gameUUID: 'g-1',
          name: 'Quiz',
          published: true,
          visibility: 'public',
          editing: false,
          publishing: false,
          updatedAt: '2026-11-02T10:00:00Z',
        },
      ],
    });
  });
});
