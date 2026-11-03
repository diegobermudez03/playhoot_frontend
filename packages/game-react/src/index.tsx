// The React surface of a game's client: mounting, the player's view, commands, inputs, assets and
// the server's events and errors. Bundled into the game's frontend artifact. Responsibility and
// boundaries: see ../README.md.
import {
  defaultValues,
  effectiveLanguage,
  gameLanguages,
  validateValues,
  type Command,
  type FieldIssue,
  type Fields,
  type GameLanguage,
  type PhaseView,
  type ValuesOf,
} from '@playhoot/game-core';

export { ranking, type PhaseView, type Standing } from '@playhoot/game-core';
import {
  createPlayhoot,
  PlayhootError,
  type GameAssetType,
  type Presentation,
} from '@playhoot/game-sdk';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
} from 'react';
import { createRoot } from 'react-dom/client';

import {
  createStore,
  RuntimeContext,
  useRuntime,
  type AssetState,
  type GameRuntime,
  type Store,
} from './runtime';

export type { AssetState } from './runtime';
export {
  Grid,
  Panel,
  Screen,
  Stack,
  Text,
  defaultTheme,
  u,
  usePresentation,
  type Presentation,
  type PresentationDensity,
  type Theme,
  type Tone,
} from './presentation';
export { Button, Choices, TextAnswer, type ChoiceMark } from './controls';
export { defineTexts, useLanguage, useText, type Texts } from './texts';
export { AssetImage, Countdown, Scoreboard } from './status';

// A command's answer: what the game's handler returned, or why it did not run. `invalid_payload`
// is answered before sending, with the fields that broke their declaration.
export type CommandResult =
  { ok: true; value?: unknown } | { ok: false; code: string; details?: unknown };

// One asset game.project.json declares, as `import { assets } from '@playhoot/assets'` gives it.
export interface AssetRef {
  readonly key: string;
  readonly type: GameAssetType;
  readonly optional: boolean;
}

// Whether a change of the inputs was sent; refused changes are not.
export type InputsResult =
  { ok: true } | { ok: false; code: 'invalid_inputs'; details: FieldIssue[] };

const loadingAsset: AssetState = { status: 'loading', url: null };

// Starts the game: declares its assets, connects to the Host and renders `Game` into the page. The
// build calls it with the assets and languages game.project.json declares.
export async function mountGame(
  Game: ComponentType,
  options: {
    assets?: Readonly<Record<string, AssetRef>>;
    languages?: readonly [GameLanguage, ...GameLanguage[]];
    container?: Element | null;
  } = {},
) {
  const playhoot = createPlayhoot();
  const view = createStore<unknown>(null);
  playhoot.onProjection((projection) => view.set(projection.state));
  const presentation = createStore<Presentation | null>(null);
  playhoot.onPresentation((next) => presentation.set(next));

  const assets: GameRuntime['assets'] = new Map();
  const declared = Object.values(options.assets ?? {});
  if (declared.length > 0) {
    const handles = playhoot.assets(
      Object.fromEntries(declared.map((asset) => [asset.key, asset.type])),
    );
    for (const asset of declared) {
      const handle = handles[asset.key];
      if (handle !== undefined) {
        assets.set(asset.key, {
          handle,
          optional: asset.optional,
          state: createStore(loadingAsset),
        });
      }
    }
  }

  const context = await playhoot.ready();
  presentation.set(playhoot.presentation());
  let inputs: { store: Store<Record<string, unknown>>; fields: Fields } | null = null;
  const runtime: GameRuntime = {
    playhoot,
    context,
    language: effectiveLanguage(options.languages ?? gameLanguages, context.locale),
    view,
    presentation,
    assets,
    inputsFor(fields) {
      inputs ??= { store: createStore<Record<string, unknown>>(defaultValues(fields)), fields };
      return inputs;
    },
  };
  const element = options.container ?? document.getElementById('root') ?? document.body;
  createRoot(element).render(
    <RuntimeContext.Provider value={runtime}>
      <Game />
    </RuntimeContext.Provider>,
  );
}

// What this player sees now (what the game's `view` returned for them), or null before the first.
export function useView<V>(): V | null {
  const { view } = useRuntime();
  return useSyncExternalStore(view.subscribe, view.get) as V | null;
}

// The current phase of a game that declares phases (the `phase` the platform adds to every view),
// or null before the first view and between phases. `secondsLeft` comes from the server once a second.
export function usePhase<Name extends string = string, Submission = unknown>(): PhaseView<
  Name,
  Submission
> | null {
  const view = useView<{ phase?: PhaseView<Name, Submission> | null }>();
  return view?.phase ?? null;
}

// Who is playing: this player's id, everyone's ids and their Playhoot language (the language the
// game shows them is useLanguage()).
export function usePlayer(): { id: string; players: readonly string[]; locale: string } {
  const { context } = useRuntime();
  return { id: context.participantId, players: context.participants, locale: context.locale };
}

// A command's payload as the client writes it: a declared `phase` field is filled in for it.
type Payload<F extends Fields> = 'phase' extends keyof F
  ? Omit<ValuesOf<F>, 'phase'> & { phase?: number }
  : ValuesOf<F>;

type Send<F extends Fields> =
  Exclude<keyof F, 'phase'> extends never
    ? (payload?: Payload<F>) => Promise<CommandResult>
    : (payload: Payload<F>) => Promise<CommandResult>;

// A function that sends one declared command: `const answer = useCommand(commands.answer)`. A
// payload that breaks the command's declaration is answered `invalid_payload` without sending.
// When the command declares a `phase` field, the current phase's id goes in it unless given, so
// the server refuses it as STALE_PHASE if the phase changed meanwhile.
export function useCommand<F extends Fields>(command: Command<string, F>): Send<F> {
  const { playhoot, view } = useRuntime();
  const send = useCallback(
    async (given?: Payload<F>): Promise<CommandResult> => {
      let payload: Record<string, unknown> = { ...given };
      if ('phase' in command.payload && payload.phase === undefined) {
        const current = (view.get() as { phase?: PhaseView | null } | null)?.phase;
        payload = { ...payload, phase: current?.id ?? 0 };
      }
      const checked = validateValues(command.payload, payload);
      if (!checked.ok) return { ok: false, code: 'invalid_payload', details: checked.issues };
      const result = await playhoot.command(command.name, checked.value as Record<string, unknown>);
      if (result.outcome !== 'executed') return { ok: false, code: result.outcome };
      const response = result.response as CommandResult | undefined;
      return response ?? { ok: true };
    },
    [playhoot, view, command],
  );
  return send as Send<F>;
}

// This player's continuous inputs (held keys, a joystick): their current values and a setter that
// changes some of them and sends the whole snapshot. Every component using it shares one snapshot;
// it starts at the declared defaults. A change breaking the declaration is refused, not sent.
export function useInputs<I extends Fields>(
  inputs: I,
): [ValuesOf<I>, (change: Partial<ValuesOf<I>>) => InputsResult] {
  const runtime = useRuntime();
  const { store, fields } = runtime.inputsFor(inputs);
  const current = useSyncExternalStore(store.subscribe, store.get) as ValuesOf<I>;
  const set = useCallback(
    (change: Partial<ValuesOf<I>>): InputsResult => {
      const checked = validateValues(fields, { ...store.get(), ...change });
      if (!checked.ok) return { ok: false, code: 'invalid_inputs', details: checked.issues };
      const next = checked.value as Record<string, unknown>;
      if (JSON.stringify(next) !== JSON.stringify(store.get())) {
        store.set(next);
        runtime.playhoot.sample(next);
      }
      return { ok: true };
    },
    [runtime, store, fields],
  );
  return [current, set];
}

// A declared asset's URL for an `img`, `audio` or `video`: `useAsset(assets.cardBack)`.
export function useAsset(asset: AssetRef): AssetState {
  const { playhoot, assets } = useRuntime();
  const entry = assets.get(asset.key);
  const [missing] = useState(() => createStore<AssetState>({ status: 'missing', url: null }));
  const state = entry?.state ?? missing;
  useEffect(() => {
    if (entry === undefined || entry.state.get().status !== 'loading') return;
    playhoot.load(entry.handle).then(
      (url) => entry.state.set({ status: 'ready', url }),
      (error: unknown) =>
        entry.state.set({
          status:
            error instanceof PlayhootError && error.code === 'asset_missing' ? 'missing' : 'error',
          url: null,
        }),
    );
  }, [playhoot, entry]);
  return useSyncExternalStore(state.subscribe, state.get);
}

// Calls handler with every event the server's emit() addressed to this player, once each.
export function useGameEvent<E = unknown>(handler: (event: E) => void): void {
  const { playhoot } = useRuntime();
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => playhoot.onEvent((event) => latest.current(event as E)), [playhoot]);
}

// Calls handler with every error the server's error() sent this player, once each.
export function useGameError<E = unknown>(handler: (error: E) => void): void {
  const { playhoot } = useRuntime();
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => playhoot.onError((error) => latest.current(error as E)), [playhoot]);
}
