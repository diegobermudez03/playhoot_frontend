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

  it('sends edits and maps the diffs and edit diagnostics they answer', async () => {
    const t = gamesWith(() =>
      json(200, {
        outcome: 'applied',
        revision: 4,
        diffs: [{ path: 'notes.md', diff: '-a\n+b\n', truncated: true }],
      }),
    );
    const edits = [{ path: 'notes.md', find: 'a', replace: 'b', all: true }];
    const result = await t.games.applyChange(
      'g-1',
      { baseRevision: 3, files: [], edits, delete: [] },
      'k-3',
    );
    expect(result).toEqual({
      ok: true,
      value: {
        outcome: 'applied',
        revision: 4,
        buildStatus: null,
        asset: null,
        diffs: [{ path: 'notes.md', diff: '-a\n+b\n', truncated: true }],
      },
    });
    expect(JSON.parse(t.fetchImpl.mock.calls[0]![1]!.body as string)).toMatchObject({ edits });

    const ambiguous = gamesWith(() =>
      json(422, {
        code: 'invalid_change',
        message: 'm',
        diagnostics: [
          { path: 'notes.md', code: 'edit_ambiguous', edit: 0, message: 'edit 0: twice' },
        ],
      }),
    );
    expect(
      await ambiguous.games.applyChange(
        'g',
        { baseRevision: 1, files: [], edits, delete: [] },
        'k',
      ),
    ).toEqual({
      ok: false,
      error: {
        kind: 'invalid',
        diagnostics: [
          { path: 'notes.md', code: 'edit_ambiguous', edit: 0, message: 'edit 0: twice' },
        ],
      },
    });
  });

  it('reads the history with the provenance of each revision', async () => {
    const t = gamesWith(() =>
      json(200, [
        {
          number: 3,
          kind: 'restore',
          origin: 'mcp',
          actor: 'ai',
          parent: 2,
          restored_from: 1,
          sdk: 'sdk-v1',
          files: 5,
          created_at: '2026-11-06T10:00:00Z',
        },
        {
          number: 1,
          kind: 'edition',
          actor: 'platform',
          from: { game_uuid: 'g-1', version_uuid: 'v-0', revision: 7 },
          sdk: 'sdk-v1',
          files: 5,
          created_at: '2026-11-06T09:00:00Z',
        },
      ]),
    );
    const result = await t.games.listRevisions('g-1');
    expect(result.ok && result.value).toEqual([
      {
        number: 3,
        kind: 'restore',
        origin: 'mcp',
        actor: 'ai',
        parent: 2,
        restoredFrom: 1,
        from: null,
        sdk: 'sdk-v1',
        files: 5,
        createdAt: '2026-11-06T10:00:00Z',
      },
      {
        number: 1,
        kind: 'edition',
        origin: null,
        actor: 'platform',
        parent: null,
        restoredFrom: null,
        from: { gameUUID: 'g-1', versionUUID: 'v-0', revision: 7 },
        sdk: 'sdk-v1',
        files: 5,
        createdAt: '2026-11-06T09:00:00Z',
      },
    ]);
  });

  it('compares two revisions', async () => {
    const t = gamesWith(() =>
      json(200, {
        from: 2,
        to: 4,
        files: [
          { path: 'notes.md', status: 'modified', diff: '-a', truncated: true },
          { path: 'shared/big.ts', status: 'added', omitted: true },
        ],
      }),
    );
    const result = await t.games.diffRevisions('g-1', 2, { path: 'notes.md' });
    expect(t.fetchImpl.mock.calls[0]![0]).toBe('/v1/games/g-1/draft/diff?from=2&path=notes.md');
    expect(result).toEqual({
      ok: true,
      value: {
        from: 2,
        to: 4,
        files: [
          { path: 'notes.md', status: 'modified', diff: '-a', truncated: true, omitted: false },
          { path: 'shared/big.ts', status: 'added', diff: null, truncated: false, omitted: true },
        ],
      },
    });
  });

  it('creates a game from a template and finds templates', async () => {
    const created = gamesWith(() => json(201, { game_uuid: 'g', version_uuid: 'v', revision: 1 }));
    await created.games.createGame('Quiz', 'k', 't-1');
    expect(JSON.parse(created.fetchImpl.mock.calls[0]![1]!.body as string)).toEqual({
      name: 'Quiz',
      idempotency_key: 'k',
      template_game_uuid: 't-1',
    });

    const entry = {
      game_uuid: 't-1',
      name: 'Quiz',
      players_min: 1,
      players_max: 30,
      featured: true,
    };
    const search = gamesWith(() => json(200, { page: 2, templates: [entry], more: true }));
    const page = await search.games.searchTemplates({ text: 'quiz', players: 4, page: 2 });
    expect(search.fetchImpl.mock.calls[0]![0]).toBe('/v1/templates/search?q=quiz&players=4&page=2');
    expect(page.ok && page.value).toEqual({
      page: 2,
      more: true,
      templates: [
        {
          gameUUID: 't-1',
          name: 'Quiz',
          description: '',
          categories: [],
          playersMin: 1,
          playersMax: 30,
          languages: [],
          featured: true,
        },
      ],
    });

    const inspect = gamesWith(() =>
      json(200, {
        game_uuid: 't-1',
        name: 'Quiz',
        revision: 9,
        brief: { goal: 'Answer' },
        manifest: { players: { min: 1, max: 30 }, commands: { answer: {} } },
        files: [{ path: 'server/game.ts', sha256: 's', size: 10 }],
      }),
    );
    const details = await inspect.games.inspectTemplate('t-1');
    expect(details.ok && details.value).toMatchObject({
      revision: 9,
      players: { min: 1, max: 30 },
      commands: ['answer'],
      files: [{ path: 'server/game.ts', size: 10 }],
    });

    const gone = gamesWith(() => json(404, { code: 'template_not_found', message: 'm' }));
    const refused = await gone.games.useTemplate('g', 't-1', 3, 'k');
    expect(gone.fetchImpl.mock.calls[0]![0]).toBe('/v1/games/g/draft/template');
    expect(!refused.ok && refused.error).toEqual({ kind: 'template-not-found' });
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
      kind: 'single',
      result: {
        raw: answer,
        resultId: null,
        revision: 3,
        toolchainVersion: null,
        players: [],
        passed: null,
        expectations: null,
        finished: true,
        stopped: null,
        commands: 2,
        rejected: 1,
        events: 0,
        errors: 0,
        scriptError: null,
        observedAtMs: [],
      },
    });
  });

  it('reads a summary with its failed expectations, and a batch', async () => {
    const summary = {
      format: 'playhoot.simulation-summary.v1',
      result_id: 'r-1',
      revision: 4,
      toolchain_version: 'tc-1',
      players: ['P1', 'P2'],
      passed: false,
      expectations: {
        total: 2,
        passed: 1,
        failed: [
          {
            index: 1,
            at_ms: 500,
            of: 'P1',
            path: 'score',
            op: 'eq',
            expected: 2,
            passed: false,
            actual: 1,
          },
        ],
      },
      finished: false,
      stopped: 'duration',
      observed_at_ms: [500],
      counts: { commands: 3, rejected: 1, events: 2, errors: 0 },
      rejected: [],
      errors: [],
    };
    const t = gamesWith(() => json(200, summary));
    const single = await t.games.runSimulation('g-1', { scenario_path: 'scenarios/a.json' });
    expect(single.ok && single.value).toMatchObject({
      kind: 'single',
      result: {
        resultId: 'r-1',
        toolchainVersion: 'tc-1',
        passed: false,
        commands: 3,
        events: 2,
        observedAtMs: [500],
        expectations: {
          total: 2,
          passed: 1,
          failed: [
            {
              index: 1,
              atMs: 500,
              of: 'P1',
              path: 'score',
              expected: 2,
              actual: 1,
              notObserved: false,
            },
          ],
        },
      },
    });

    const batch = gamesWith(() =>
      json(200, {
        format: 'playhoot.simulation-batch.v1',
        revision: 4,
        passed: false,
        scenarios: [
          { path: 'scenarios/a.json', summary },
          { path: 'scenarios/b.json', diagnostics: [{ field: 'format', message: 'must be v1' }] },
        ],
        skipped: [],
      }),
    );
    const all = await batch.games.runSimulation('g-1', { all: true });
    expect(all.ok && all.value.kind).toBe('batch');
    if (!all.ok || all.value.kind !== 'batch') return;
    expect(all.value.batch.passed).toBe(false);
    expect(all.value.batch.scenarios[0]!.result?.resultId).toBe('r-1');
    expect(all.value.batch.scenarios[1]).toEqual({
      path: 'scenarios/b.json',
      result: null,
      diagnostics: [{ field: 'format', message: 'must be v1' }],
    });
  });

  it('reads one state of a kept result, or why there is none', async () => {
    const t = gamesWith(() =>
      json(200, {
        result_id: 'r-1',
        of: 'P1',
        path: 'hand',
        requested_at_ms: 500,
        at_ms: 500,
        value: [1, 2],
      }),
    );
    const found = await t.games.readSimulationState('g-1', 'r-1', {
      atMs: 500,
      of: 'P1',
      path: 'hand',
    });
    expect(t.fetchImpl.mock.calls[0]![0]).toBe(
      '/v1/games/g-1/draft/simulations/r-1/state?at_ms=500&of=P1&path=hand',
    );
    expect(found.ok && found.value).toEqual({
      status: 'found',
      of: 'P1',
      path: 'hand',
      atMs: 500,
      final: false,
      value: [1, 2],
      tooLarge: false,
      size: null,
      keys: [],
      length: null,
    });

    const notObserved = gamesWith(() =>
      json(404, { code: 'not_observed', message: 'm', observed_at_ms: [100, 500] }),
    );
    const missing = await notObserved.games.readSimulationState('g-1', 'r-1', { atMs: 300 });
    expect(missing.ok && missing.value).toEqual({
      status: 'missing',
      reason: 'not-observed',
      observedAtMs: [100, 500],
    });

    const expired = gamesWith(() => json(404, { code: 'simulation_not_found', message: 'm' }));
    const gone = await expired.games.readSimulationState('g-1', 'r-1', {});
    expect(gone.ok && gone.value).toMatchObject({ status: 'missing', reason: 'expired' });
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
      kind: 'single',
      result: { stopped: 'script_failure', scriptError: 'update() threw: boom', commands: 0 },
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

  it('maps a start the game failed in its script, and a malformed preview request', async () => {
    const failed = gamesWith(() => json(422, { code: 'preview_script_failure', message: 'm' }));
    const scriptFailure = await failed.games.createPreview('g-1', 2);
    expect(!scriptFailure.ok && scriptFailure.error).toEqual({ kind: 'script-failure' });

    const malformed = gamesWith(() => json(400, { error: 'players must be at least 1' }));
    const badRequest = await malformed.games.createPreview('g-1', 0);
    expect(!badRequest.ok && badRequest.error).toEqual({ kind: 'bad-request' });
  });

  it('creates a game with its name', async () => {
    const t = gamesWith(() => json(201, { game_uuid: 'g-1', version_uuid: 'v-1', revision: 1 }));
    const created = await t.games.createGame('Tap Race', 'k-1');
    expect(JSON.parse(String(t.fetchImpl.mock.calls[0]![1]?.body))).toEqual({
      name: 'Tap Race',
      idempotency_key: 'k-1',
    });
    expect(created).toEqual({
      ok: true,
      value: { gameUUID: 'g-1', versionUUID: 'v-1', revision: 1 },
    });
  });

  it('reads and changes the card, its logo and photos', async () => {
    const card = gamesWith(() =>
      json(200, {
        game_uuid: 'g-1',
        name: 'Tap Race',
        description: '',
        logo: { uuid: 'l-1', mime_type: 'image/png', size: 10, url: 'https://s/l' },
        photos: [],
        visibility: 'private',
        published: false,
        editing: true,
        publishing: false,
      }),
    );
    expect(await card.games.readCard('g-1')).toMatchObject({
      ok: true,
      value: {
        name: 'Tap Race',
        logo: { uuid: 'l-1', url: 'https://s/l' },
        publishedAt: null,
        live: null,
      },
    });

    const live = gamesWith(() =>
      json(200, {
        game_uuid: 'g-1',
        name: 'Tap Race',
        description: '',
        logo: null,
        photos: [],
        visibility: 'public',
        published: true,
        published_at: '2026-11-03T10:00:00Z',
        editing: false,
        publishing: false,
        live: {
          release_sequence: 2,
          revision: 7,
          version_uuid: 'v-7',
          published_at: '2026-11-03T10:00:00Z',
        },
      }),
    );
    expect(await live.games.readCard('g-1')).toMatchObject({
      ok: true,
      value: {
        live: {
          releaseSequence: 2,
          revision: 7,
          versionUUID: 'v-7',
          publishedAt: '2026-11-03T10:00:00Z',
        },
      },
    });

    const patched = gamesWith(() => json(200, { outcome: 'done' }));
    const saved = await patched.games.updateCard('g-1', { description: 'd' });
    expect(saved).toEqual({ ok: true, value: undefined });
    expect(patched.fetchImpl.mock.calls[0]![1]?.method).toBe('PATCH');

    const logo = gamesWith(() =>
      json(200, { outcome: 'done', image: { uuid: 'l-2', mime_type: 'image/png', size: 4 } }),
    );
    await logo.games.uploadLogo('g-1', new Blob(['x'], { type: 'image/png' }), 'k-2');
    expect(logo.fetchImpl.mock.calls[0]![0]).toBe('/v1/games/g-1/logo');
    const headers = new Headers(logo.fetchImpl.mock.calls[0]![1]?.headers);
    expect(headers.get('Idempotency-Key')).toBe('k-2');

    const tooMany = gamesWith(() => json(409, { code: 'too_many_photos', message: 'm' }));
    const refused = await tooMany.games.uploadPhoto('g-1', new Blob(['x']), 'k-3');
    expect(!refused.ok && refused.error.kind).toBe('too-many-photos');
  });

  it('publishes, reports what blocks it, and opens a new edition', async () => {
    const published = gamesWith(() =>
      json(200, {
        outcome: 'published',
        release_uuid: 'r-1',
        sequence: 1,
        version_uuid: 'v-1',
        revision: 3,
        visibility: 'public',
      }),
    );
    expect(await published.games.publish('g-1', { visibility: 'public' }, 'k-1')).toEqual({
      ok: true,
      value: {
        releaseUUID: 'r-1',
        sequence: 1,
        versionUUID: 'v-1',
        revision: 3,
        visibility: 'public',
      },
    });

    const blocked = gamesWith(() =>
      json(409, {
        code: 'not_ready',
        message: 'm',
        blockers: [
          { code: 'build_not_succeeded', build_status: 'FAILED' },
          { code: 'missing_required_assets', keys: ['cardBack'] },
        ],
      }),
    );
    const refused = await blocked.games.publish('g-1', { visibility: 'private' }, 'k-2');
    expect(!refused.ok && refused.error).toEqual({
      kind: 'not-ready',
      blockers: [
        { code: 'build_not_succeeded', buildStatus: 'FAILED', keys: [] },
        { code: 'missing_required_assets', buildStatus: null, keys: ['cardBack'] },
      ],
    });

    const edition = gamesWith(() => json(201, { version_uuid: 'v-2', revision: 1 }));
    expect(await edition.games.openEdition('g-1', 'k-3')).toEqual({
      ok: true,
      value: { versionUUID: 'v-2', revision: 1 },
    });
    const open = gamesWith(() => json(409, { code: 'edition_open', message: 'm' }));
    const again = await open.games.openEdition('g-1', 'k-4');
    expect(!again.ok && again.error.kind).toBe('edition-open');
  });
});
