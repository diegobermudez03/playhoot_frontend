import type { GamesClient, SimulationResult } from '@playhoot/communication';
import { describe, expect, it, vi } from 'vitest';

import { createScenarioRunner, parsePastedScenario } from './scenarioRunner';

const scenario = { format: 'playhoot.scenario.v1', players: 2, duration_ms: 1000, steps: [] };

const result: SimulationResult = {
  raw: { format: 'playhoot.simulation-result.v1', finished: true },
  revision: 3,
  finished: true,
  stopped: null,
  commands: 0,
  rejected: 0,
  events: 0,
  errors: 0,
  scriptError: null,
};

function fakeGames(runSimulation: GamesClient['runSimulation']): GamesClient {
  return { runSimulation } as GamesClient;
}

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
    const run = vi.fn<GamesClient['runSimulation']>(async () => ({ ok: true, value: result }));
    const runner = createScenarioRunner({ games: fakeGames(run), gameUUID: 'g-1' });
    const running = runner.run(scenario);
    expect(runner.store.getState().run).toEqual({ status: 'running' });
    // A second run while one runs is ignored.
    await runner.run(scenario);
    await running;
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith('g-1', scenario);
    expect(runner.store.getState().run).toEqual({ status: 'done', result });
    runner.clear();
    expect(runner.store.getState().run).toEqual({ status: 'idle' });
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
    answer({ ok: true, value: result });
    await running;
    expect(runner.store.getState().run).toEqual({ status: 'idle' });
  });
});
