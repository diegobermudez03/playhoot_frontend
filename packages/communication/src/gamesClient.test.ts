import { describe, expect, it, vi } from 'vitest';

import { createGamesClient } from './gamesClient';
import { createHttpClient } from './http';

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers });

function gamesWith(answer: () => Response) {
  const fetchImpl = vi.fn<typeof fetch>(async () => answer());
  const games = createGamesClient(
    createHttpClient({ baseUrl: '', credentials: { currentToken: () => 't-1' }, fetch: fetchImpl }),
  );
  return { games, fetchImpl };
}

const draftBody = {
  game_uuid: 'g-1',
  version_uuid: 'v-1',
  status: 'DRAFT',
  current_revision: 2,
  revision: 2,
  files: [{ path: 'server/game.ts', sha256: 'a', size: 10, content: 'x' }],
  assets: [{ key: 'cardBack', type: 'image', description: 'Back', status: 'missing' }],
  asset_diagnostics: [],
  attempts: [
    {
      kind: 'change',
      outcome: 'invalid',
      base_revision: 1,
      origin: 'web',
      diagnostics: [{ path: '../x', code: 'path_outside', message: 'no' }],
      created_at: '2026-11-02T10:00:00Z',
    },
  ],
  build: {
    revision: 2,
    status: 'FAILED',
    diagnostics: [{ stage: 'types', file: 'server/game.ts', line: 20, column: 3, message: 'bad' }],
    reused: false,
    queued_at: '2026-11-02T10:00:00Z',
  },
  last_successful_build: null,
};

describe('createGamesClient', () => {
  it('reads a draft with its content and maps it', async () => {
    const t = gamesWith(() => json(200, draftBody));
    const result = await t.games.readDraft('g-1', { content: true });
    expect(t.fetchImpl.mock.calls[0]![0]).toBe('/v1/games/g-1/draft?content=true');
    expect(result.ok && result.value).toMatchObject({
      currentRevision: 2,
      files: [{ path: 'server/game.ts', content: 'x' }],
      assets: [{ key: 'cardBack', status: 'missing', optional: false, url: null }],
      attempts: [{ outcome: 'invalid', diagnostics: [{ code: 'path_outside' }] }],
      build: { status: 'FAILED', diagnostics: [{ stage: 'types', line: 20 }] },
      lastSuccessfulBuild: null,
    });
  });

  it('sends the change envelope in snake_case', async () => {
    const t = gamesWith(() =>
      json(200, { outcome: 'applied', revision: 3, build: { status: 'QUEUED' } }),
    );
    const result = await t.games.applyChange(
      'g-1',
      { baseRevision: 2, files: [{ path: 'notes.md', content: 'hi' }], delete: [] },
      'k-1',
    );
    expect(result).toEqual({
      ok: true,
      value: { outcome: 'applied', revision: 3, buildStatus: 'QUEUED', asset: null },
    });
    expect(JSON.parse(t.fetchImpl.mock.calls[0]![1]!.body as string)).toEqual({
      format: 'playhoot.project-change.v1',
      base_revision: 2,
      files: [{ path: 'notes.md', content: 'hi' }],
      delete: [],
      idempotency_key: 'k-1',
    });
  });

  it('maps a conflict with the current revision, and invalid changes with diagnostics', async () => {
    const conflict = gamesWith(() =>
      json(409, { code: 'revision_conflict', message: 'm', current_revision: 5 }),
    );
    expect(
      await conflict.games.applyChange('g', { baseRevision: 1, files: [], delete: [] }, 'k'),
    ).toEqual({ ok: false, error: { kind: 'conflict', currentRevision: 5 } });

    const invalid = gamesWith(() =>
      json(422, {
        code: 'invalid_change',
        message: 'm',
        diagnostics: [{ path: 'a', code: 'c', message: 'why' }],
      }),
    );
    expect(
      await invalid.games.applyChange('g', { baseRevision: 1, files: [], delete: [] }, 'k'),
    ).toEqual({
      ok: false,
      error: { kind: 'invalid', diagnostics: [{ path: 'a', code: 'c', message: 'why' }] },
    });
  });

  it('uploads an asset as the raw body with the Idempotency-Key header', async () => {
    const t = gamesWith(() =>
      json(200, {
        outcome: 'attached',
        revision: 4,
        asset: { key: 'cardBack', type: 'image', status: 'ready', mime_type: 'image/png' },
      }),
    );
    const file = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
    const result = await t.games.uploadAsset('g-1', 'cardBack', file, 'k-2');
    const [url, init] = t.fetchImpl.mock.calls[0]!;
    expect(url).toBe('/v1/games/g-1/draft/assets/cardBack');
    expect(init?.method).toBe('PUT');
    expect(init?.body).toBe(file);
    expect(init?.headers).toMatchObject({ 'Idempotency-Key': 'k-2', 'Content-Type': 'image/png' });
    expect(result.ok && result.value.asset).toMatchObject({
      status: 'ready',
      mimeType: 'image/png',
    });
  });

  it('tells a too large file, a busy instance and an unknown refusal apart', async () => {
    const tooLarge = gamesWith(() =>
      json(413, { code: 'asset_too_large', message: 'm', diagnostics: [] }),
    );
    expect((await tooLarge.games.uploadAsset('g', 'k', new Blob(['x']), 'i')).ok).toBe(false);
    const busy = gamesWith(() =>
      json(503, { code: 'uploads_busy', message: 'm' }, { 'Retry-After': '5' }),
    );
    expect(await busy.games.uploadAsset('g', 'k', new Blob(['x']), 'i')).toEqual({
      ok: false,
      error: { kind: 'busy', retryAfterSeconds: 5 },
    });
    const unknown = gamesWith(() => json(409, { code: 'something_new', message: 'm' }));
    const result = await unknown.games.removeAsset('g', 'k', 'i');
    expect(!result.ok && result.error.kind).toBe('unavailable');
  });

  it('caps the build wait at 20 seconds', async () => {
    const t = gamesWith(() => json(200, { revision: 3, status: 'SUCCEEDED', reused: true }));
    const result = await t.games.readBuild('g-1', 3, 60);
    expect(t.fetchImpl.mock.calls[0]![0]).toBe('/v1/games/g-1/draft/build?revision=3&wait=20');
    expect(result.ok && result.value).toMatchObject({
      status: 'SUCCEEDED',
      reused: true,
      diagnostics: [],
    });
  });

  it('creates, reads and revokes the AI link', async () => {
    const created = gamesWith(() =>
      json(201, {
        url: 'https://api.example/ai/v1/phl_secret',
        expires_at: '2026-11-09T10:00:00Z',
      }),
    );
    const link = await created.games.createAiLink('g-1');
    expect(created.fetchImpl.mock.calls[0]![0]).toBe('/v1/games/g-1/ai-link');
    expect(created.fetchImpl.mock.calls[0]![1]?.method).toBe('POST');
    expect(link).toEqual({
      ok: true,
      value: { url: 'https://api.example/ai/v1/phl_secret', expiresAt: '2026-11-09T10:00:00Z' },
    });

    const status = gamesWith(() =>
      json(200, {
        active: true,
        created_at: '2026-11-02T10:00:00Z',
        expires_at: '2026-11-09T10:00:00Z',
      }),
    );
    expect(await status.games.readAiLink('g-1')).toEqual({
      ok: true,
      value: { active: true, createdAt: '2026-11-02T10:00:00Z', expiresAt: '2026-11-09T10:00:00Z' },
    });
    const none = gamesWith(() => json(200, { active: false }));
    expect(await none.games.readAiLink('g-1')).toEqual({
      ok: true,
      value: { active: false, createdAt: null, expiresAt: null },
    });

    const revoked = gamesWith(() => new Response(null, { status: 204 }));
    expect(await revoked.games.revokeAiLink('g-1')).toEqual({ ok: true, value: undefined });
    expect(revoked.fetchImpl.mock.calls[0]![0]).toBe('/v1/games/g-1/ai-link/revoke');

    const missing = gamesWith(() => json(404, { code: 'not_found', message: 'm' }));
    const refused = await missing.games.createAiLink('g-1');
    expect(!refused.ok && refused.error.kind).toBe('not-found');
  });
  it('runs a scenario, sending it as is and keeping the whole result', async () => {
    const answer = {
      format: 'playhoot.simulation-result.v1',
      revision: 3,
      finished: true,
      observations: [{ at_ms: 1000, state: { n: 1 }, views: { P1: { me: 'P1' } } }],
      final: { at_ms: 1500, state: { n: 2 } },
      commands: [{ at_ms: 100, player: 'P1', response: { ok: true } }, { at_ms: 200 }],
      rejected: [{ at_ms: 300 }],
      events: [],
      errors: [],
      extra: { kept: true },
    };
    const t = gamesWith(() => json(200, answer));
    const scenario = { format: 'playhoot.scenario.v1', players: 2, steps: [] };
    const result = await t.games.runSimulation('g-1', scenario);
    expect(t.fetchImpl.mock.calls[0]![0]).toBe('/v1/games/g-1/draft/simulations');
    expect(JSON.parse(t.fetchImpl.mock.calls[0]![1]!.body as string)).toEqual(scenario);
    expect(result.ok && result.value).toEqual({
      raw: answer,
      revision: 3,
      finished: true,
      stopped: null,
      commands: 2,
      rejected: 1,
      events: 0,
      errors: 0,
      scriptError: null,
    });
  });

  it('summarizes a script error and an early stop', async () => {
    const t = gamesWith(() =>
      json(200, {
        format: 'playhoot.simulation-result.v1',
        finished: false,
        stopped: { reason: 'script_failure' },
        script_error: { message: 'update() threw: boom' },
      }),
    );
    const result = await t.games.runSimulation('g-1', {});
    expect(result.ok && result.value).toMatchObject({
      stopped: 'script_failure',
      scriptError: 'update() threw: boom',
      commands: 0,
    });
  });

  it('maps the refusals of a simulation', async () => {
    const notReady = gamesWith(() =>
      json(409, { code: 'build_not_ready', message: 'm', build: { status: 'FAILED' } }),
    );
    const refused = await notReady.games.runSimulation('g-1', {});
    expect(!refused.ok && refused.error).toEqual({
      kind: 'build-not-ready',
      buildStatus: 'FAILED',
    });

    const invalid = gamesWith(() =>
      json(422, {
        code: 'invalid_scenario',
        message: 'm',
        diagnostics: [{ path: 'steps[0].player', code: 'unknown_player', message: 'P9' }],
      }),
    );
    const rejected = await invalid.games.runSimulation('g-1', {});
    expect(!rejected.ok && rejected.error).toEqual({
      kind: 'invalid',
      diagnostics: [{ path: 'steps[0].player', code: 'unknown_player', message: 'P9' }],
    });

    const busy = gamesWith(() =>
      json(503, { code: 'simulations_busy', message: 'm' }, { 'Retry-After': '3' }),
    );
    const waited = await busy.games.runSimulation('g-1', {});
    expect(!waited.ok && waited.error).toEqual({ kind: 'busy', retryAfterSeconds: 3 });
  });
});
