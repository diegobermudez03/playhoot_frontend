// The mounted game's runtime, shared by the hooks and components of this package. Internal: games
// reach it only through the exported hooks.
import type { Fields } from '@playhoot/game-core';
import type { AssetHandle, GameContext, Playhoot, Presentation } from '@playhoot/game-sdk';
import { createContext, useContext } from 'react';

// An asset's URL once loaded. `missing`: this version holds no file for it (render a fallback);
// `error`: it could not be loaded.
export type AssetState =
  { status: 'loading' | 'missing' | 'error'; url: null } | { status: 'ready'; url: string };

export interface Store<T> {
  get(): T;
  set(value: T): void;
  subscribe(listener: () => void): () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next) {
      value = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export interface GameRuntime {
  playhoot: Playhoot;
  context: GameContext;
  view: Store<unknown>;
  presentation: Store<Presentation | null>;
  assets: Map<string, { handle: AssetHandle; optional: boolean; state: Store<AssetState> }>;
  // The inputs snapshot, created by the first useInputs with the game's declaration.
  inputsFor(fields: Fields): { store: Store<Record<string, unknown>>; fields: Fields };
}

export const RuntimeContext = createContext<GameRuntime | null>(null);

export function useRuntime(): GameRuntime {
  const runtime = useContext(RuntimeContext);
  if (runtime === null) throw new Error('Playhoot hooks run only inside a mounted game');
  return runtime;
}
