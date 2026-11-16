import { describe, expect, it, vi } from 'vitest';

import { createHttpClient } from './http';
import { createNotificationsClient } from './notificationsClient';

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

describe('createNotificationsClient', () => {
  it('reads the unread count and the entries, keeping a type it does not know', async () => {
    const { client, fetchImpl } = http(() =>
      json(200, {
        unread: 2,
        entries: [
          {
            entry_uuid: 'e1',
            source_domain: 'budget',
            type: 'budget-level-changed',
            skeleton: { level: 'reduced' },
            email: true,
            necessary: true,
            read_at: null,
            created_at: '2026-11-15T10:00:00Z',
          },
          {
            entry_uuid: 'e2',
            source_domain: 'classes',
            type: 'a-type-from-a-later-milestone',
            skeleton: null,
            email: false,
            necessary: false,
            read_at: '2026-11-15T11:00:00Z',
            created_at: '2026-11-15T09:00:00Z',
          },
        ],
      }),
    );

    const result = await createNotificationsClient(client).list(20);

    expect(result).toEqual({
      ok: true,
      value: {
        unread: 2,
        entries: [
          {
            entryUUID: 'e1',
            sourceDomain: 'budget',
            type: 'budget-level-changed',
            skeleton: { level: 'reduced' },
            email: true,
            necessary: true,
            readAt: null,
            createdAt: '2026-11-15T10:00:00Z',
          },
          {
            entryUUID: 'e2',
            sourceDomain: 'classes',
            type: 'a-type-from-a-later-milestone',
            skeleton: {},
            email: false,
            necessary: false,
            readAt: '2026-11-15T11:00:00Z',
            createdAt: '2026-11-15T09:00:00Z',
          },
        ],
      },
    });
    expect(String(fetchImpl.mock.calls[0]![0])).toBe('/v1/notifications?limit=20');
  });

  it('marks one entry read by its identifier', async () => {
    const { client, fetchImpl } = http(() => json(200, { outcome: 'marked' }));

    expect(await createNotificationsClient(client).markRead('e 1')).toEqual({
      ok: true,
      value: undefined,
    });
    expect(fetchImpl.mock.calls.map(([url, init]) => [String(url), init?.method])).toEqual([
      ['/v1/notifications/e%201/read', 'POST'],
    ]);
  });

  it('separates a rejected credential from an unknown entry and from being busy', async () => {
    const cases = [
      [401, 'unauthenticated'],
      [403, 'unauthenticated'],
      [404, 'not-found'],
      [429, 'busy'],
      [500, 'unavailable'],
    ] as const;
    for (const [status, kind] of cases) {
      const { client } = http(() => json(status, { message: 'no' }));
      const result = await createNotificationsClient(client).list();
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe(kind);
    }
  });
});
