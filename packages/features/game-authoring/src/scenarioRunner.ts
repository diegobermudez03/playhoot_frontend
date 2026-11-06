import type {
  GamesClient,
  GamesFailure,
  SimulationAnswer,
  SimulationState,
} from '@playhoot/communication';
import { scenarioFormat } from '@playhoot/protocol';
import { createStore, type StoreApi } from 'zustand/vanilla';

import { readPastedJson, type PastedJsonError } from './pastedJson';

// "Escenarios": the person runs a scenario their AI wrote (pasted), one the project saves under
// scenarios/, or all of them, against the build of the draft's current revision, and copies the
// result back to their AI. The backend keeps each result for a while; one value of it can be read
// on demand (`inspect`).

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

// The scenarios a project saves: its scenarios/*.json files.
export function savedScenarioPaths(paths: readonly string[]): string[] {
  return paths
    .filter((path) => path.startsWith('scenarios/') && path.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b));
}

export type ScenarioRun =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'done'; answer: SimulationAnswer }
  | { status: 'failed'; failure: GamesFailure };

// One value asked of a kept result: where, and what came back.
export interface StateInspection {
  resultID: string;
  atMs: number | null;
  of: string;
  path: string;
  status: 'loading' | 'done' | 'failed';
  state: SimulationState | null;
}

export interface ScenarioRunnerState {
  run: ScenarioRun;
  inspection: StateInspection | null;
}

export interface ScenarioRunner {
  store: StoreApi<ScenarioRunnerState>;
  // Runs a scenario `parsePastedScenario` accepted; a second run while one runs is ignored.
  run(scenario: Record<string, unknown>): Promise<void>;
  // Runs the scenario saved at `path`.
  runSaved(path: string): Promise<void>;
  // Runs every saved scenario.
  runAll(): Promise<void>;
  // Reads one value of a kept result: at `atMs` (null: the end), of `of`, at `path`.
  inspect(resultID: string, atMs: number | null, of: string, path: string): Promise<void>;
  // Forgets the last result.
  clear(): void;
  dispose(): void;
}

export function createScenarioRunner(deps: {
  games: GamesClient;
  gameUUID: string;
}): ScenarioRunner {
  const { games, gameUUID } = deps;
  const store = createStore<ScenarioRunnerState>(() => ({
    run: { status: 'idle' },
    inspection: null,
  }));
  let disposed = false;

  const simulate = async (request: unknown) => {
    if (store.getState().run.status === 'running') return;
    store.setState({ run: { status: 'running' }, inspection: null });
    const result = await games.runSimulation(gameUUID, request);
    if (disposed) return;
    store.setState({
      run: result.ok
        ? { status: 'done', answer: result.value }
        : { status: 'failed', failure: result.error },
    });
  };

  return {
    store,
    run: (scenario) => simulate(scenario),
    runSaved: (path) => simulate({ scenario_path: path }),
    runAll: () => simulate({ all: true }),
    async inspect(resultID, atMs, of, path) {
      const inspection: StateInspection = {
        resultID,
        atMs,
        of,
        path,
        status: 'loading',
        state: null,
      };
      store.setState({ inspection });
      const result = await games.readSimulationState(gameUUID, resultID, {
        ...(atMs === null ? {} : { atMs }),
        of,
        path,
      });
      // A newer inspection, a new run or clearing replaced this one meanwhile.
      if (disposed || store.getState().inspection !== inspection) return;
      store.setState({
        inspection: result.ok
          ? { ...inspection, status: 'done', state: result.value }
          : { ...inspection, status: 'failed' },
      });
    },
    clear: () => store.setState({ run: { status: 'idle' }, inspection: null }),
    dispose: () => {
      disposed = true;
      store.setState({ run: { status: 'idle' }, inspection: null });
    },
  };
}
