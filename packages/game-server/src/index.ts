// How a game declares its authoritative logic. Runs in the backend sandbox, bundled into the game's
// script under the compile profile `sdk-v1`. Responsibility and boundaries: see ../README.md.
import type { Command, Fields, ValuesOf } from '@playhoot/game-core';

export { addPoints, ranking, type Scores, type Standing } from '@playhoot/game-core';

// What every handler gets besides the state. `now` is the Session time in milliseconds of this
// operation (0 at start), `elapsed` the time since the previous operation.
export interface GameContext {
  readonly now: number;
  readonly elapsed: number;
  // Sends an event to everyone, or only to the given players.
  emit(event: unknown, to?: string | readonly string[]): void;
  // Tells one player their action was wrong, without changing anything else.
  error(player: string, error: unknown): void;
  // Ends the game after this operation; the last view each player gets is the final one.
  finish(): void;
}

export interface PlayerContext extends GameContext {
  readonly player: string;
}

export interface CommandContext<P> extends PlayerContext {
  readonly payload: P;
}

export interface InputContext<I> extends PlayerContext {
  readonly inputs: I;
}

// A command refused by the game's rules: `return reject('NOT_YOUR_TURN')`. Refuse before changing
// the state, because changes made before the refusal are kept.
export interface Rejection {
  readonly rejected: string;
  readonly details?: unknown;
}

export function reject(code: string, details?: unknown): Rejection {
  return details === undefined ? { rejected: code } : { rejected: code, details };
}

// The phase the game is in, when it declares phases. `id` counts every phase entered since the
// start (a command carrying an older one is stale); `round` counts the entries of this phase, from 1.
export interface PhaseInfo<Name extends string = string> {
  readonly name: Name;
  readonly id: number;
  readonly round: number;
  readonly startedAt: number;
  // When it ends by itself (Session time, ms), or null when it has no deadline.
  readonly endsAt: number | null;
}

// Handlers of a game with phases also get the current phase, and can end it now.
export interface PhaseControls<Name extends string = string> {
  readonly phase: PhaseInfo<Name> | null;
  // Ends the current phase at this operation's time, as if its deadline had come.
  endPhase(): void;
}

export interface PhaseEndContext<Name extends string, Submission> extends GameContext {
  readonly phase: PhaseInfo<Name>;
  // Each player's submission in this phase; players who sent nothing are absent.
  readonly submissions: Readonly<Record<string, Submission>>;
}

type PayloadOf<C, K> = K extends keyof C
  ? C[K] extends Command<string, infer F extends Fields>
    ? ValuesOf<F>
    : never
  : never;

export interface Phase<S, C, Name extends string, K> {
  // Its deadline, from when it starts. Without it the phase lasts until endPhase() is called.
  seconds?: number;
  // The command whose payload is each player's private submission in this phase. It needs no
  // handler: the platform records it, last one counts (unless `lock`), and nobody else sees it.
  submit?: K & keyof C;
  // Other commands allowed in this phase. A command some phase lists is refused in the others
  // (WRONG_PHASE); a command no phase lists is allowed in every phase.
  accepts?: readonly (keyof C & string)[];
  // End as soon as every player still in the game has submitted (default true with `submit`).
  untilAllSubmit?: boolean;
  // A submission cannot be changed once sent (ALREADY_SUBMITTED).
  lock?: boolean;
  // Runs when the phase starts.
  start?(state: S, context: GameContext & { readonly phase: PhaseInfo<Name> }): void;
  // Runs when it ends, with the submissions: copy into the state what may be revealed. Returns the
  // next phase, or nothing to stay without a phase (call finish() to end the game).
  end?(state: S, context: PhaseEndContext<Name, PayloadOf<C, K>>): Name | void;
}

type Handlers<S, C, Name extends string> = {
  [K in keyof C]?: C[K] extends Command<string, infer F extends Fields>
    ? (state: S, context: CommandContext<ValuesOf<F>> & PhaseControls<Name>) => unknown
    : never;
};

export interface ViewContext<Name extends string = string> {
  readonly now: number;
  // The current phase, null without phases or between them.
  readonly phase: PhaseInfo<Name> | null;
  // Who has submitted in the current phase, and this player's own submission (never others').
  readonly submitted: readonly string[];
  readonly mine: unknown;
}

export interface GameDefinition<
  S,
  C extends Readonly<Record<string, Command>> = Record<never, Command>,
  I extends Fields = Record<never, never>,
  V = unknown,
  // Each phase's name, mapped to the command it collects as submissions (if any).
  P extends Record<string, unknown> = Record<never, never>,
> {
  players: { min: number; max: number };
  commands?: C;
  inputs?: I;
  // The initial state. State is plain JSON: handlers change it in place and the platform keeps it.
  setup(players: string[]): S;
  // The game's phases by name, and the first one (default: the first declared). With phases the
  // platform runs their deadlines, submissions and transitions; see the guide's phases page.
  phases?: { [N in keyof P]: Phase<S, C, keyof P & string, P[N]> };
  firstPhase?: keyof P & string;
  // One handler per command. Its return value is the command's answer to its sender.
  on?: Handlers<S, C, keyof P & string>;
  // Called for each change of a player's inputs.
  input?(state: S, context: InputContext<ValuesOf<I>> & PhaseControls<keyof P & string>): void;
  // Called about every 100 ms while the game runs, after any phase that was due ended.
  update?(state: S, context: GameContext & PhaseControls<keyof P & string>): void;
  // A player left or lost the connection for good.
  leave?(state: S, context: PlayerContext): void;
  // A player who left comes back; return false to refuse them. Without it nobody comes back.
  rejoin?(state: S, context: PlayerContext): boolean;
  // What one player sees. Never send them what they must not know. With phases, the platform adds
  // `phase` (PhaseView) to the object returned.
  view(state: S, player: string, context: ViewContext<keyof P & string>): V;
}

export function defineGame<
  S,
  C extends Readonly<Record<string, Command>> = Record<never, Command>,
  I extends Fields = Record<never, never>,
  V = unknown,
  P extends Record<string, unknown> = Record<never, never>,
>(definition: GameDefinition<S, C, I, V, P>): GameDefinition<S, C, I, V, P> {
  return definition;
}
