import type { AiAccessClient, AiAccessFailure, GamesClient } from '@playhoot/communication';
import { describe, expect, it, vi } from 'vitest';

import { createAiConnectionsList, createAiConsent, createMyGamesList } from './aiAccess';

const ok = <T>(value: T) => ({ ok: true as const, value });
const fail = (error: AiAccessFailure) => ({ ok: false as const, error });

const request = {
  clientName: 'Claude',
  clientUri: null,
  redirectHost: 'claude.ai',
  scopes: ['games'],
  expiresAt: '2026-11-03T10:10:00Z',
};

function accessWith(overrides: Partial<AiAccessClient>): AiAccessClient {
  return {
    readAuthorization: vi.fn(async () => ok(request)),
    approveAuthorization: vi.fn(async () => ok('https://claude.ai/cb?code=1')),
    denyAuthorization: vi.fn(async () => ok('https://claude.ai/cb?error=access_denied')),
    listConnections: vi.fn(async () => ok([])),
    revokeConnection: vi.fn(async () => ok(undefined)),
    ...overrides,
  };
}

describe('createAiConsent', () => {
  it('reads the request and answers where the browser goes after approving', async () => {
    const access = accessWith({});
    const consent = createAiConsent({ access, requestID: 'r1' });
    await consent.load();
    expect(consent.store.getState()).toEqual({
      status: 'ready',
      request,
      deciding: null,
      failed: false,
    });
    await consent.decide('approve');
    expect(consent.store.getState()).toEqual({
      status: 'decided',
      redirectURL: 'https://claude.ai/cb?code=1',
    });
    expect(access.denyAuthorization).not.toHaveBeenCalled();
  });

  it('tells an unknown, expired or used request apart, also when deciding', async () => {
    const gone = createAiConsent({
      access: accessWith({ readAuthorization: vi.fn(async () => fail({ kind: 'not-found' })) }),
      requestID: 'r1',
    });
    await gone.load();
    expect(gone.store.getState()).toEqual({ status: 'gone' });

    const late = createAiConsent({
      access: accessWith({ denyAuthorization: vi.fn(async () => fail({ kind: 'not-found' })) }),
      requestID: 'r1',
    });
    await late.load();
    await late.decide('deny');
    expect(late.store.getState()).toEqual({ status: 'gone' });
  });

  it('keeps the request when deciding fails, to try again', async () => {
    const consent = createAiConsent({
      access: accessWith({
        approveAuthorization: vi.fn(async () =>
          fail({ kind: 'busy', retryAfterSeconds: undefined }),
        ),
      }),
      requestID: 'r1',
    });
    await consent.load();
    await consent.decide('approve');
    expect(consent.store.getState()).toMatchObject({
      status: 'ready',
      deciding: null,
      failed: true,
    });
  });
});

describe('createAiConnectionsList', () => {
  it('revokes a connection and reads the list again', async () => {
    const listConnections = vi
      .fn<AiAccessClient['listConnections']>()
      .mockResolvedValueOnce(
        ok([{ connectionID: 'c1', clientName: 'Claude', createdAt: 'x', lastUsedAt: null }]),
      )
      .mockResolvedValueOnce(ok([]));
    const access = accessWith({ listConnections });
    const list = createAiConnectionsList({ access });
    await list.load();
    expect(list.store.getState().load).toMatchObject({
      status: 'ready',
      items: [{ connectionID: 'c1' }],
    });
    await list.revoke('c1');
    expect(access.revokeConnection).toHaveBeenCalledWith('c1');
    expect(list.store.getState()).toEqual({
      load: { status: 'ready', items: [] },
      revoking: null,
      revokeFailed: false,
    });
  });
});

describe('createMyGamesList', () => {
  it("loads the caller's games", async () => {
    const games = {
      listGames: vi.fn(async () =>
        ok([
          {
            gameUUID: 'g1',
            name: 'Quiz',
            published: false,
            visibility: 'private',
            editing: true,
            publishing: false,
            updatedAt: 'x',
          },
        ]),
      ),
    } as unknown as GamesClient;
    const list = createMyGamesList({ games });
    await list.load();
    expect(list.store.getState().load).toMatchObject({
      status: 'ready',
      items: [{ name: 'Quiz' }],
    });
  });
});
