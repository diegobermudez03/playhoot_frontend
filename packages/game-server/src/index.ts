// How a game declares its authoritative logic. Runs in the backend sandbox, bundled into the game's
// script under the compile profile `sdk-v1`. Responsibility and boundaries: see ../README.md.
import type { Command, Fields, ValuesOf } from '@playhoot/game-core';

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

type Handlers<S, C> = {
  [K in keyof C]: C[K] extends Command<string, infer F extends Fields>
    ? (state: S, context: CommandContext<ValuesOf<F>>) => unknown
    : never;
};

export interface GameDefinition<
  S,
  C extends Readonly<Record<string, Command>> = Record<never, Command>,
  I extends Fields = Record<never, never>,
  V = unknown,
> {
  players: { min: number; max: number };
  commands?: C;
  inputs?: I;
  // The initial state. State is plain JSON: handlers change it in place and the platform keeps it.
  setup(players: string[]): S;
  // One handler per declared command. Its return value is the command's answer to its sender.
  on?: Handlers<S, C>;
  // Called for each change of a player's inputs.
  input?(state: S, context: InputContext<ValuesOf<I>>): void;
  // Called about every 100 ms while the game runs: deadlines and time-based rules go here.
  update?(state: S, context: GameContext): void;
  // A player left or lost the connection for good.
  leave?(state: S, context: PlayerContext): void;
  // A player who left comes back; return false to refuse them. Without it nobody comes back.
  rejoin?(state: S, context: PlayerContext): boolean;
  // What one player sees. Never send them what they must not know.
  view(state: S, player: string, context: { readonly now: number }): V;
}

export function defineGame<
  S,
  C extends Readonly<Record<string, Command>> = Record<never, Command>,
  I extends Fields = Record<never, never>,
  V = unknown,
>(definition: GameDefinition<S, C, I, V>): GameDefinition<S, C, I, V> {
  return definition;
}
