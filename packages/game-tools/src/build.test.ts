import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import { describe, expect, it } from 'vitest';

import { build } from './build.ts';

const tapRace = fileURLToPath(new URL('../../../fixtures/sdk-games/tap-race', import.meta.url));

describe('build', () => {
  it('builds Tap Race into a script the sandbox ABI can run', async () => {
    const result = await build(tapRace);
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));

    expect(result.manifest).toEqual({
      schema_version: 1,
      players: { min: 1, max: 8 },
      inputs: {},
      commands: { tap: { payload: {} } },
      entrypoints: ['update'],
    });
    expect(result.record.profile).toBe('sdk-v1');
    expect(result.server.startsWith('"use strict";')).toBe(true);
    expect(result.server).not.toMatch(/^export /m);
    expect(result.client).toContain('<div id="root"></div>');

    // The sandbox calls the entrypoints with fresh JSON each time.
    const context = vm.createContext({});
    vm.runInContext(result.server, context);
    const call = (code: string) => JSON.parse(vm.runInContext(`JSON.stringify(${code})`, context));
    let state = call(`start(["P1", "P2"], { sessionTime: 0, elapsed: 0 }).state`);
    expect(state).toEqual({ taps: { P1: 0, P2: 0 }, winner: null });

    const tapped = call(
      `command(${JSON.stringify(state)}, { participant: "P1", name: "tap", payload: {}, sessionTime: 10 }, { sessionTime: 10, elapsed: 10 })`,
    );
    expect(tapped).toEqual({
      state: { taps: { P1: 1, P2: 0 }, winner: null },
      response: { ok: true },
    });
    state = tapped.state;

    expect(
      call(`project(${JSON.stringify(state)}, "P2", { sessionTime: 1500, elapsed: 0 })`),
    ).toEqual({
      me: 'P2',
      taps: { P1: 1, P2: 0 },
      goal: 20,
      secondsLeft: 29,
      winner: null,
    });
    expect(call(`update(${JSON.stringify(state)}, { sessionTime: 30000, elapsed: 100 })`)).toEqual({
      state: { taps: { P1: 1, P2: 0 }, winner: 'P1' },
      finished: true,
    });
    expect(vm.runInContext('__playhoot_module_values().length', context)).toBe(2);
  });

  it('reports the author mistakes with their file and line', async () => {
    const root = await mkdtemp(join(tmpdir(), 'playhoot-game-'));
    try {
      await mkdir(join(root, 'server'));
      await mkdir(join(root, 'client'));
      await writeFile(
        join(root, 'game.project.json'),
        JSON.stringify({ format: 'playhoot.project.v1' }),
      );
      await writeFile(
        join(root, 'server/game.ts'),
        `import { defineGame } from '@playhoot/game-server';\nlet rounds = 0;\nexport default defineGame({ players: { min: 1, max: 2 }, setup: () => ({}), view: () => rounds });\n`,
      );
      await writeFile(
        join(root, 'client/Game.tsx'),
        `export default function Game() { return null; }\n`,
      );
      const result = await build(root);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.diagnostics).toEqual([
        expect.objectContaining({ stage: 'source', file: 'server/game.ts', line: 2 }),
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
