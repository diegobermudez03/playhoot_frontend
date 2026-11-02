import type { GamesClient } from '@playhoot/communication';
import { describe, expect, it, vi } from 'vitest';

import { createAiLinkSharing } from './aiLink';

const unavailable = {
  kind: 'unavailable' as const,
  failure: { kind: 'network' as const, message: 'down' },
};

function fakeGames(overrides: Partial<GamesClient> = {}): GamesClient {
  return {
    readAiLink: vi.fn(async () => ({
      ok: true as const,
      value: { active: false, createdAt: null, expiresAt: null },
    })),
    createAiLink: vi.fn(async () => ({
      ok: true as const,
      value: { url: 'https://api.example/ai/v1/phl_secret', expiresAt: '2026-11-09T10:00:00Z' },
    })),
    revokeAiLink: vi.fn(async () => ({ ok: true as const, value: undefined })),
    ...overrides,
  } as GamesClient;
}

describe('createAiLinkSharing', () => {
  it('shows the created link once and reads the status again', async () => {
    const games = fakeGames();
    const sharing = createAiLinkSharing({ games, gameUUID: 'g-1' });
    await sharing.load();
    expect(sharing.store.getState().load).toEqual({
      status: 'ready',
      link: { active: false, createdAt: null, expiresAt: null },
    });

    vi.mocked(games.readAiLink).mockResolvedValueOnce({
      ok: true,
      value: { active: true, createdAt: '2026-11-02T10:00:00Z', expiresAt: '2026-11-09T10:00:00Z' },
    });
    await sharing.create();
    expect(sharing.store.getState().created).toEqual({
      url: 'https://api.example/ai/v1/phl_secret',
      expiresAt: '2026-11-09T10:00:00Z',
    });
    expect(sharing.store.getState().load).toMatchObject({ link: { active: true } });

    sharing.forgetCreated();
    expect(sharing.store.getState().created).toBeNull();
  });

  it('forgets the link when revoked or disposed', async () => {
    const games = fakeGames();
    const sharing = createAiLinkSharing({ games, gameUUID: 'g-1' });
    await sharing.create();
    await sharing.revoke();
    expect(games.revokeAiLink).toHaveBeenCalledWith('g-1');
    expect(sharing.store.getState().created).toBeNull();

    await sharing.create();
    sharing.dispose();
    expect(sharing.store.getState().created).toBeNull();
  });

  it('tells which action failed', async () => {
    const games = fakeGames({
      createAiLink: vi.fn(async () => ({ ok: false as const, error: unavailable })),
      readAiLink: vi.fn(async () => ({ ok: false as const, error: unavailable })),
    });
    const sharing = createAiLinkSharing({ games, gameUUID: 'g-1' });
    await sharing.load();
    expect(sharing.store.getState().load).toEqual({ status: 'failed' });
    await sharing.create();
    expect(sharing.store.getState()).toMatchObject({ failed: 'create', created: null, busy: null });
  });
});
