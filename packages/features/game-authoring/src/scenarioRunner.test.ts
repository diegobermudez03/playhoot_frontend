import type { GamesClient, SimulationAnswer, SimulationResult } from '@playhoot/communication';
import { describe, expect, it, vi } from 'vitest';

import { createScenarioRunner, parsePastedScenario, savedScenarioPaths } from './scenarioRunner';

const scenario = { format: 'playhoot.scenario.v1', players: 2, duration_ms: 1000, steps: [] };

const result: SimulationResult = {
  raw: { format: 'playhoot.simulation-summary.v1', finished: true },
  resultId: 'r-1',
  revision: 3,
  toolchainVersion: null,
  players: ['P1', 'P2'],
  passed: null,
  expectations: null,
  finished: true,
  stopped: null,
  commands: 0,
  rejected: 0,
  events: 0,
  errors: 0,
  scriptError: null,
  observedAtMs: [500],
};
const single: SimulationAnswer = { kind: 'single', result };

function fakeGames(
  runSimulation: GamesClient['runSimulation'],
  readSimulationState: GamesClient['readSimulationState'] = vi.fn(),
): GamesClient {
  return { runSimulation, readSimulationState } as GamesClient;
}

describe('savedScenarioPaths', () => {
  it('lists the scenarios a project saves, sorted', () => {
    expect(
      savedScenarioPaths(['notes.md', 'scenarios/b.json', 'scenarios/a.json', 'server/game.ts']),
    ).toEqual(['scenarios/a.json', 'scenarios/b.json']);
  });
});

describe('parsePastedScenario', () => {
  it('accepts the scenario as JSON or inside one code fence', () => {
    const text = JSON.stringify(scenario);
    expect(parsePastedScenario(text)).toEqual({ ok: true, scenario });
    expect(parsePastedScenario('```json\n' + text + '\n```')).toEqual({ ok: true, scenario });
  });

  it('refuses anything else without repairing it', () => {
    const text = JSON.stringify(scenario);
    expect(parsePastedScenario('  ')).toEqual({ ok: false, error: { kind: 'empty' } });
    expect(parsePastedScenario('Here it is: ' + text)).toEqual({
      ok: false,
      error: { kind: 'not-json' },
    });
    expect(parsePastedScenario('Here:\n```json\n' + text + '\n```')).toEqual({
      ok: false,
      error: { kind: 'not-an-envelope' },
    });
    expect(parsePastedScenario(text.slice(0, -5))).toEqual({
      ok: false,
      error: { kind: 'not-json' },
    });
    expect(parsePastedScenario('{"format":"playhoot.project-change.v1"}')).toEqual({
      ok: false,
      error: { kind: 'wrong-format', found: 'playhoot.project-change.v1' },
    });
    expect(parsePastedScenario('[1]')).toEqual({ ok: false, error: { kind: 'not-an-envelope' } });
  });
});

describe('createScenarioRunner', () => {
  it('runs a scenario and keeps its result in memory', async () => {
    const run = vi.fn<GamesClient['runSimulation']>(async () => ({ ok: true, value: single }));
    const runner = createScenarioRunner({ games: fakeGames(run), gameUUID: 'g-1' });
    const running = runner.run(scenario);
    expect(runner.store.getState().run).toEqual({ status: 'running' });
    // A second run while one runs is ignored.
    await runner.run(scenario);
    await running;
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith('g-1', scenario);
    expect(runner.store.getState().run).toEqual({ status: 'done', answer: single });
    runner.clear();
    expect(runner.store.getState().run).toEqual({ status: 'idle' });
  });

  it('runs a saved scenario by path, or all of them', async () => {
    const run = vi.fn<GamesClient['runSimulation']>(async () => ({ ok: true, value: single }));
    const runner = createScenarioRunner({ games: fakeGames(run), gameUUID: 'g-1' });
    await runner.runSaved('scenarios/win.json');
    expect(run).toHaveBeenLastCalledWith('g-1', { scenario_path: 'scenarios/win.json' });
    await runner.runAll();
    expect(run).toHaveBeenLastCalledWith('g-1', { all: true });
  });

  it('reads one state of a kept result and keeps only the newest read', async () => {
    let answerFirst: (value: unknown) => void = () => {};
    const read = vi
      .fn()
      .mockReturnValueOnce(new Promise((resolve) => (answerFirst = resolve)))
      .mockResolvedValueOnce({
        ok: true,
        value: {
          status: 'found',
          of: 'P1',
          path: 'hand',
          atMs: 500,
          final: false,
          value: [1],
          tooLarge: false,
          size: null,
          keys: [],
          length: null,
        },
      });
    const runner = createScenarioRunner({
      games: fakeGames(vi.fn(), read as GamesClient['readSimulationState']),
      gameUUID: 'g-1',
    });

    const first = runner.inspect('r-1', null, 'global', '');
    await runner.inspect('r-1', 500, 'P1', 'hand');
    answerFirst({ ok: true, value: { status: 'missing', reason: 'expired', observedAtMs: [] } });
    await first;

    expect(read).toHaveBeenNthCalledWith(1, 'g-1', 'r-1', { of: 'global', path: '' });
    expect(read).toHaveBeenNthCalledWith(2, 'g-1', 'r-1', { atMs: 500, of: 'P1', path: 'hand' });
    expect(runner.store.getState().inspection).toMatchObject({
      atMs: 500,
      status: 'done',
      state: { status: 'found', value: [1] },
    });
  });

  it('tells why a run did not happen', async () => {
    const runner = createScenarioRunner({
      games: fakeGames(async () => ({
        ok: false,
        error: { kind: 'build-not-ready', buildStatus: 'FAILED' },
      })),
      gameUUID: 'g-1',
    });
    await runner.run(scenario);
    expect(runner.store.getState().run).toEqual({
      status: 'failed',
      failure: { kind: 'build-not-ready', buildStatus: 'FAILED' },
    });
  });

  it('forgets the result when disposed, even if it arrives later', async () => {
    let answer!: (value: Awaited<ReturnType<GamesClient['runSimulation']>>) => void;
    const runner = createScenarioRunner({
      games: fakeGames(() => new Promise((resolve) => (answer = resolve))),
      gameUUID: 'g-1',
    });
    const running = runner.run(scenario);
    runner.dispose();
    answer({ ok: true, value: single });
    await running;
    expect(runner.store.getState().run).toEqual({ status: 'idle' });
  });
});
