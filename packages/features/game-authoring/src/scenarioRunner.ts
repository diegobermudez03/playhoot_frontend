import type { GamesClient, GamesFailure, SimulationResult } from '@playhoot/communication';
import { scenarioFormat } from '@playhoot/protocol';
import { createStore, type StoreApi } from 'zustand/vanilla';

import { readPastedJson, type PastedJsonError } from './pastedJson';

// "Escenarios": the person pastes a scenario their AI wrote, runs it against the build of the
// draft's current revision, and copies the result back to their AI. Nothing is kept: the result
// lives in this store's memory only.

export type PastedScenarioError =
  | PastedJsonError
  // JSON, but another format or none.
  | { kind: 'wrong-format'; found: string | null };

export type PastedScenario =
  { ok: true; scenario: Record<string, unknown> } | { ok: false; error: PastedScenarioError };

// Reads the pasted scenario strictly as data. Only its format is checked here: the backend checks
// the rest and answers its diagnostics.
export function parsePastedScenario(text: string): PastedScenario {
  const read = readPastedJson(text);
  if (!read.ok) return { ok: false, error: read.error };
  if (read.value.format !== scenarioFormat) {
    const found = read.value.format;
    return {
      ok: false,
      error: { kind: 'wrong-format', found: typeof found === 'string' ? found : null },
    };
  }
  return { ok: true, scenario: read.value };
}

export type ScenarioRun =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'done'; result: SimulationResult }
  | { status: 'failed'; failure: GamesFailure };

export interface ScenarioRunnerState {
  run: ScenarioRun;
}

export interface ScenarioRunner {
  store: StoreApi<ScenarioRunnerState>;
  // Runs a scenario `parsePastedScenario` accepted; a second run while one runs is ignored.
  run(scenario: Record<string, unknown>): Promise<void>;
  // Forgets the last result.
  clear(): void;
  dispose(): void;
}

export function createScenarioRunner(deps: {
  games: GamesClient;
  gameUUID: string;
}): ScenarioRunner {
  const { games, gameUUID } = deps;
  const store = createStore<ScenarioRunnerState>(() => ({ run: { status: 'idle' } }));
  let disposed = false;

  return {
    store,
    async run(scenario) {
      if (store.getState().run.status === 'running') return;
      store.setState({ run: { status: 'running' } });
      const result = await games.runSimulation(gameUUID, scenario);
      if (disposed) return;
      store.setState({
        run: result.ok
          ? { status: 'done', result: result.value }
          : { status: 'failed', failure: result.error },
      });
    },
    clear: () => store.setState({ run: { status: 'idle' } }),
    dispose: () => {
      disposed = true;
      store.setState({ run: { status: 'idle' } });
    },
  };
}
