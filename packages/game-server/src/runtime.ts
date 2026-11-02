// The adapter between a game definition and the backend sandbox ABI (`play/runtime/sandbox` in the
// backend). The build tools generate the script's global entrypoints, each calling one of these
// with the game's definition. Never imported by game code.
import { manifestFields, type Fields } from '@playhoot/game-core';

import type { GameContext, GameDefinition, Rejection } from './index';

interface SandboxContext {
  sessionTime: number;
  elapsed: number;
}

interface Output {
  events: { event: unknown; participants?: string[] }[];
  errors: { participant: string; error: unknown }[];
  finished: boolean;
}

// Every definition the adapter accepts, whatever its state and declarations.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyGame = GameDefinition<any, any, any, any>;

function gameContext(output: Output, now: number, elapsed: number): GameContext {
  return {
    now,
    elapsed,
    emit(event, to) {
      if (to === undefined) output.events.push({ event });
      else output.events.push({ event, participants: typeof to === 'string' ? [to] : [...to] });
    },
    error(player, error) {
      output.errors.push({ participant: player, error });
    },
    finish() {
      output.finished = true;
    },
  };
}

function newOutput(): Output {
  return { events: [], errors: [], finished: false };
}

function result(state: unknown, output: Output, extra?: Record<string, unknown>) {
  const answer: Record<string, unknown> = { state, ...extra };
  if (output.events.length > 0) answer.events = output.events;
  if (output.errors.length > 0) answer.errors = output.errors;
  if (output.finished) answer.finished = true;
  return answer;
}

function isRejection(value: unknown): value is Rejection {
  return (
    typeof value === 'object' && value !== null && typeof (value as Rejection).rejected === 'string'
  );
}

export function __playhoot_start(game: AnyGame, participants: string[]) {
  return { state: game.setup(participants) };
}

export function __playhoot_command(
  game: AnyGame,
  state: unknown,
  command: { participant: string; name: string; payload: unknown; sessionTime: number },
  context: SandboxContext,
) {
  const output = newOutput();
  const handler = (game.on as Record<string, (s: unknown, c: unknown) => unknown> | undefined)?.[
    command.name
  ];
  if (handler === undefined) throw new Error(`the game has no handler for command ${command.name}`);
  const answer = handler(state, {
    ...gameContext(output, command.sessionTime, context.elapsed),
    player: command.participant,
    payload: command.payload,
  });
  let response: unknown = { ok: true };
  if (isRejection(answer)) {
    response =
      answer.details === undefined
        ? { ok: false, code: answer.rejected }
        : { ok: false, code: answer.rejected, details: answer.details };
  } else if (answer !== undefined) {
    response = { ok: true, value: answer };
  }
  return result(state, output, { response });
}

export function __playhoot_samples(
  game: AnyGame,
  state: unknown,
  transitions: { participant: string; inputs: unknown; sessionTime: number }[],
  context: SandboxContext,
) {
  const output = newOutput();
  for (const transition of transitions) {
    game.input?.(state, {
      ...gameContext(output, transition.sessionTime, context.elapsed),
      player: transition.participant,
      inputs: transition.inputs as never,
    });
  }
  return result(state, output);
}

export function __playhoot_update(game: AnyGame, state: unknown, context: SandboxContext) {
  const output = newOutput();
  game.update?.(state, gameContext(output, context.sessionTime, context.elapsed));
  return result(state, output);
}

export function __playhoot_player_disconnected(
  game: AnyGame,
  state: unknown,
  participant: string,
  context: SandboxContext,
) {
  const output = newOutput();
  game.leave?.(state, {
    ...gameContext(output, context.sessionTime, context.elapsed),
    player: participant,
  });
  return result(state, output);
}

export function __playhoot_player_rejoined(
  game: AnyGame,
  state: unknown,
  participant: string,
  context: SandboxContext,
) {
  const output = newOutput();
  const accepted =
    game.rejoin?.(state, {
      ...gameContext(output, context.sessionTime, context.elapsed),
      player: participant,
    }) ?? false;
  return result(state, output, { accepted: accepted === true });
}

export function __playhoot_project(
  game: AnyGame,
  state: unknown,
  participant: string,
  context: SandboxContext,
) {
  return game.view(state, participant, { now: context.sessionTime });
}

// The runtime manifest the backend stores with the version, derived from the definition so it can
// never disagree with the code.
export function __playhoot_manifest_of(game: AnyGame) {
  const commands: Record<string, { payload: ReturnType<typeof manifestFields> }> = {};
  const declared = (game.commands ?? {}) as Record<string, { payload: Fields }>;
  for (const name of Object.keys(declared)) {
    commands[name] = { payload: manifestFields(declared[name]?.payload ?? {}) };
  }
  const entrypoints: string[] = [];
  if (game.update !== undefined) entrypoints.push('update');
  if (game.rejoin !== undefined) entrypoints.push('playerRejoined');
  return {
    schema_version: 1,
    players: { min: game.players.min, max: game.players.max },
    inputs: manifestFields((game.inputs ?? {}) as Fields),
    commands,
    entrypoints,
  };
}
