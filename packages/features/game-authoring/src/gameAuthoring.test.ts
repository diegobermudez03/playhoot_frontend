import type { Draft, DraftBuild, GamesClient } from '@playhoot/communication';
import { describe, expect, it, vi } from 'vitest';

import { createGameAuthoring } from './gameAuthoring';
import { parsePastedChange } from './pastedChange';

const build = (revision: number, status: string): DraftBuild => ({
  revision,
  status,
  diagnostics: [],
  reused: false,
  queuedAt: null,
  finishedAt: null,
});

const draftAt = (revision: number, buildStatus = 'SUCCEEDED'): Draft => ({
  gameUUID: 'g-1',
  versionUUID: 'v-1',
  status: 'DRAFT',
  currentRevision: revision,
  revision,
  files: [{ path: 'server/game.ts', sha256: 'a', size: 1, content: 'x' }],
  assets: [],
  assetDiagnostics: [],
  attempts: [],
  build: build(revision, buildStatus),
  lastSuccessfulBuild: null,
});

function fakeGames(overrides: Partial<GamesClient> = {}): GamesClient {
  return {
    createGame: vi.fn(),
    readDraft: vi.fn(async () => ({ ok: true as const, value: draftAt(1) })),
    applyChange: vi.fn(async () => ({
      ok: true as const,
      value: { outcome: 'applied', revision: 2, buildStatus: 'QUEUED', asset: null },
    })),
    restoreRevision: vi.fn(),
    listRevisions: vi.fn(async () => ({ ok: true as const, value: [] })),
    uploadAsset: vi.fn(),
    removeAsset: vi.fn(),
    readBuild: vi.fn(async () => ({ ok: true as const, value: build(1, 'SUCCEEDED') })),
    createAiLink: vi.fn(),
    readAiLink: vi.fn(),
    revokeAiLink: vi.fn(),
    runSimulation: vi.fn(),
    ...overrides,
  } as GamesClient;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('createGameAuthoring', () => {
  it('loads the current revision with its content', async () => {
    const games = fakeGames();
    const authoring = createGameAuthoring({ games, gameUUID: 'g-1' });
    await authoring.reload();
    expect(games.readDraft).toHaveBeenCalledWith('g-1', { content: true });
    expect(authoring.store.getState()).toMatchObject({
      load: { status: 'ready' },
      draft: { currentRevision: 1 },
    });
  });

  it('tells a game that is not found from an unreachable backend', async () => {
    const missing = createGameAuthoring({
      games: fakeGames({
        readDraft: vi.fn(async () => ({
          ok: false as const,
          error: { kind: 'not-found' as const },
        })),
      }),
      gameUUID: 'g-1',
    });
    await missing.reload();
    expect(missing.store.getState().load).toEqual({ status: 'failed', reason: 'not-found' });
  });

  it('follows the build of a new revision until it ends, then reads the draft again', async () => {
    let read = 0;
    const games = fakeGames({
      readDraft: vi.fn(async () => {
        read += 1;
        return {
          ok: true as const,
          value: read === 1 ? draftAt(1) : draftAt(2, read === 2 ? 'QUEUED' : 'FAILED'),
        };
      }),
      readBuild: vi
        .fn()
        .mockResolvedValueOnce({ ok: true, value: build(2, 'RUNNING') })
        .mockResolvedValueOnce({ ok: true, value: build(2, 'FAILED') }),
    });
    const authoring = createGameAuthoring({ games, gameUUID: 'g-1', newKey: () => 'k-1' });
    await authoring.reload();

    const result = await authoring.applyChange({
      baseRevision: 1,
      files: [{ path: 'notes.md', content: 'x' }],
      delete: [],
    });
    expect(result).toEqual({ action: 'change', kind: 'applied', revision: 2 });
    await flush();
    await flush();
    expect(games.readBuild).toHaveBeenCalledWith('g-1', 2, 20);
    expect(games.readBuild).toHaveBeenCalledTimes(2);
    expect(authoring.store.getState().draft?.build?.status).toBe('FAILED');
  });

  it('reuses the key when the same action is retried, and takes a new one for another', async () => {
    let n = 0;
    const applyChange = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        error: { kind: 'unavailable', failure: { kind: 'network', message: '' } },
      })
      .mockResolvedValue({ ok: false, error: { kind: 'conflict', currentRevision: 4 } });
    const authoring = createGameAuthoring({
      games: fakeGames({ applyChange }),
      gameUUID: 'g-1',
      newKey: () => `k-${++n}`,
    });
    await authoring.reload();
    const change = { baseRevision: 1, files: [{ path: 'a.ts', content: 'x' }], delete: [] };

    expect((await authoring.applyChange(change)).kind).toBe('failed');
    expect(await authoring.applyChange(change)).toEqual({
      action: 'change',
      kind: 'conflict',
      currentRevision: 4,
    });
    await authoring.applyChange({ ...change, delete: ['b.ts'] });

    expect(applyChange.mock.calls.map((call) => call[2])).toEqual(['k-1', 'k-1', 'k-2']);
  });

  it('edits one file on the current revision', async () => {
    const games = fakeGames();
    const authoring = createGameAuthoring({ games, gameUUID: 'g-1', newKey: () => 'k' });
    await authoring.reload();
    await authoring.editFile('server/game.ts', 'y');
    expect(games.applyChange).toHaveBeenCalledWith(
      'g-1',
      { baseRevision: 1, files: [{ path: 'server/game.ts', content: 'y' }], delete: [] },
      'k',
    );
  });
});

describe('parsePastedChange', () => {
  const envelope = {
    format: 'playhoot.project-change.v1',
    base_revision: 3,
    files: [
      { path: 'server/game.ts', content: 'a' },
      { path: 'shared/new.ts', content: 'b' },
    ],
    delete: ['notes.md'],
  };

  it('reads the envelope and summarizes added, modified and deleted files', () => {
    expect(parsePastedChange(JSON.stringify(envelope), ['server/game.ts', 'notes.md'])).toEqual({
      ok: true,
      change: { baseRevision: 3, files: envelope.files, delete: ['notes.md'] },
      summary: { added: ['shared/new.ts'], modified: ['server/game.ts'], deleted: ['notes.md'] },
    });
  });

  it('accepts one wrapping code fence and nothing else around it', () => {
    const fenced = '```json\n' + JSON.stringify(envelope) + '\n```';
    expect(parsePastedChange(fenced, []).ok).toBe(true);
    expect(parsePastedChange('Here you go:\n' + fenced, []).ok).toBe(false);
    expect(parsePastedChange(fenced + '\n' + fenced, []).ok).toBe(false);
  });

  it('never repairs truncated JSON nor accepts another format', () => {
    expect(parsePastedChange(JSON.stringify(envelope).slice(0, 40), [])).toEqual({
      ok: false,
      error: { kind: 'not-json' },
    });
    expect(parsePastedChange(JSON.stringify({ ...envelope, format: 'x' }), [])).toEqual({
      ok: false,
      error: { kind: 'wrong-format', found: 'x' },
    });
    expect(parsePastedChange('  ', []).ok).toBe(false);
  });

  it('refuses malformed fields and repeated paths', () => {
    expect(parsePastedChange(JSON.stringify({ ...envelope, base_revision: '3' }), [])).toEqual({
      ok: false,
      error: { kind: 'malformed', field: 'base_revision' },
    });
    expect(
      parsePastedChange(JSON.stringify({ ...envelope, delete: ['server/game.ts'] }), []),
    ).toEqual({ ok: false, error: { kind: 'repeated-path', path: 'server/game.ts' } });
  });
});
