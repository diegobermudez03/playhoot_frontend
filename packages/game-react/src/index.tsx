// The React surface of a game's client: mounting, the player's view and commands. Bundled into the
// game's frontend artifact. Responsibility and boundaries: see ../README.md.
import type { Command, Fields, ValuesOf } from '@playhoot/game-core';
import { createPlayhoot, type GameContext, type Playhoot } from '@playhoot/game-sdk';
import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ComponentType,
} from 'react';
import { createRoot } from 'react-dom/client';

// A command's answer: what the game's handler returned, or why it did not run.
export type CommandResult =
  { ok: true; value?: unknown } | { ok: false; code: string; details?: unknown };

interface GameRuntime {
  playhoot: Playhoot;
  context: GameContext;
  view(): unknown;
  subscribe(listener: () => void): () => void;
}

const RuntimeContext = createContext<GameRuntime | null>(null);

function useRuntime(): GameRuntime {
  const runtime = useContext(RuntimeContext);
  if (runtime === null) throw new Error('Playhoot hooks run only inside a mounted game');
  return runtime;
}

// Starts the game: connects to the Host and renders `Game` into the page. The build calls it.
export async function mountGame(Game: ComponentType, container: Element | null = null) {
  const playhoot = createPlayhoot();
  let view: unknown = null;
  const listeners = new Set<() => void>();
  playhoot.onProjection((projection) => {
    view = projection.state;
    for (const listener of listeners) listener();
  });
  const context = await playhoot.ready();
  const runtime: GameRuntime = {
    playhoot,
    context,
    view: () => view,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const element = container ?? document.getElementById('root') ?? document.body;
  createRoot(element).render(
    <RuntimeContext.Provider value={runtime}>
      <Game />
    </RuntimeContext.Provider>,
  );
}

// What this player sees now (what the game's `view` returned for them), or null before the first.
export function useView<V>(): V | null {
  const runtime = useRuntime();
  return useSyncExternalStore(runtime.subscribe, runtime.view) as V | null;
}

// Who is playing: this player's id, everyone's ids and the platform language.
export function usePlayer(): { id: string; players: readonly string[]; locale: string } {
  const { context } = useRuntime();
  return { id: context.participantId, players: context.participants, locale: context.locale };
}

type Send<F extends Fields> = keyof F extends never
  ? () => Promise<CommandResult>
  : (payload: ValuesOf<F>) => Promise<CommandResult>;

// A function that sends one declared command: `const answer = useCommand(commands.answer)`.
export function useCommand<F extends Fields>(command: Command<string, F>): Send<F> {
  const { playhoot } = useRuntime();
  const send = useCallback(
    async (payload?: ValuesOf<F>): Promise<CommandResult> => {
      const result = await playhoot.command(
        command.name,
        (payload ?? {}) as Record<string, unknown>,
      );
      if (result.outcome !== 'executed') return { ok: false, code: result.outcome };
      const response = result.response as CommandResult | undefined;
      return response ?? { ok: true };
    },
    [playhoot, command.name],
  );
  return send as Send<F>;
}
