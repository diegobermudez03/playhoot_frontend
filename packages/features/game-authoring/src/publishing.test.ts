import type { GameCard, GamesClient } from '@playhoot/communication';
import { describe, expect, it, vi } from 'vitest';

import { createGamePublishing } from './publishing';

const card: GameCard = {
  gameUUID: 'g-1',
  name: 'Tap Race',
  description: '',
  logo: null,
  photos: [],
  visibility: 'private',
  published: false,
  publishedAt: null,
  editing: true,
  publishing: false,
  live: null,
};

const publication = {
  releaseUUID: 'r-1',
  sequence: 1,
  versionUUID: 'v-1',
  revision: 3,
  visibility: 'private',
};

function fakeGames(overrides: Partial<GamesClient> = {}): GamesClient {
  return {
    readCard: vi.fn(async () => ({ ok: true as const, value: card })),
    updateCard: vi.fn(async () => ({ ok: true as const, value: undefined })),
    publish: vi.fn(async () => ({ ok: true as const, value: publication })),
    openEdition: vi.fn(async () => ({
      ok: true as const,
      value: { versionUUID: 'v-2', revision: 1 },
    })),
    ...overrides,
  } as GamesClient;
}

describe('createGamePublishing', () => {
  it('loads the card and saves a change, reading it again', async () => {
    const games = fakeGames();
    const publishing = createGamePublishing({ games, gameUUID: 'g-1' });
    await publishing.load();
    expect(publishing.store.getState().load).toEqual({ status: 'ready', card });
    expect(await publishing.save({ description: 'A race' })).toBe(true);
    expect(games.updateCard).toHaveBeenCalledWith('g-1', { description: 'A race' });
    expect(publishing.store.getState().notice).toEqual({ kind: 'saved' });
    expect(games.readCard).toHaveBeenCalledTimes(2);
  });

  it('publishes, resending the same key when the same publication is retried', async () => {
    const games = fakeGames({
      publish: vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          error: { kind: 'unavailable', failure: { kind: 'network', message: 'x' } },
        })
        .mockResolvedValueOnce({ ok: true, value: publication }),
    });
    const publishing = createGamePublishing({ games, gameUUID: 'g-1' });
    expect(await publishing.publish({ visibility: 'private' })).toBe(false);
    expect(publishing.store.getState().notice).toMatchObject({ kind: 'failed', action: 'publish' });
    expect(await publishing.publish({ visibility: 'private' })).toBe(true);
    const calls = vi.mocked(games.publish).mock.calls;
    expect(calls[0]![2]).toBe(calls[1]![2]);
    expect(publishing.store.getState().notice).toEqual({ kind: 'published', publication });
  });

  it('shows what blocks a publication', async () => {
    const blockers = [{ code: 'missing_required_assets', buildStatus: null, keys: ['cardBack'] }];
    const games = fakeGames({
      publish: vi.fn(async () => ({
        ok: false as const,
        error: { kind: 'not-ready' as const, blockers },
      })),
    });
    const publishing = createGamePublishing({ games, gameUUID: 'g-1' });
    expect(await publishing.publish({ visibility: 'private' })).toBe(false);
    expect(publishing.store.getState().notice).toEqual({ kind: 'not-ready', blockers });
  });

  it('opens a new edition', async () => {
    const games = fakeGames();
    const publishing = createGamePublishing({ games, gameUUID: 'g-1' });
    expect(await publishing.openEdition()).toBe(true);
    expect(publishing.store.getState().notice).toEqual({ kind: 'edition-opened', revision: 1 });
  });
});
