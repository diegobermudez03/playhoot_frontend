// The adapter between a game definition and the backend sandbox ABI (`play/runtime/sandbox` in the
// backend). The build tools generate the script's global entrypoints, each calling one of these
// with the game's definition. Never imported by game code.
import { manifestFields, type Fields } from '@playhoot/game-core';

import type { GameContext, GameDefinition, PhaseInfo, Rejection } from './index';

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
type AnyGame = GameDefinition<any, any, any, any, any>;

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

function answerOf(answer: unknown) {
  if (isRejection(answer)) {
    return answer.details === undefined
      ? { ok: false, code: answer.rejected }
      : { ok: false, code: answer.rejected, details: answer.details };
  }
  return answer === undefined ? { ok: true } : { ok: true, value: answer };
}

// A game with phases is kept as { game, phases }: the game's own state and what the platform runs
// for it. Submissions live only here, so a view can never leak them.
interface PhaseState {
  current: PhaseInfo | null;
  // Every phase entered so far, and the entries of each phase by name.
  entered: number;
  rounds: Record<string, number>;
  submissions: Record<string, unknown>;
  // Who is still in the game, for "everyone has submitted".
  players: string[];
}

interface Kept {
  game: unknown;
  phases: PhaseState;
}

interface PhaseDefinition {
  seconds?: number;
  submit?: string;
  accepts?: readonly string[];
  untilAllSubmit?: boolean;
  lock?: boolean;
  start?(state: unknown, context: unknown): void;
  end?(state: unknown, context: unknown): string | void;
}

// More phase changes than this in one operation means phases without time between them end each
// other forever.
const maxPhaseChanges = 1000;

function phasesOf(game: AnyGame): Record<string, PhaseDefinition> | null {
  const phases = game.phases as Record<string, PhaseDefinition> | undefined;
  return phases !== undefined && Object.keys(phases).length > 0 ? phases : null;
}

function enterPhase(game: AnyGame, kept: Kept, name: string, at: number, output: Output): void {
  const phase = (phasesOf(game) ?? {})[name];
  if (phase === undefined) throw new Error(`the game has no phase ${name}`);
  const machine = kept.phases;
  machine.entered += 1;
  machine.rounds[name] = (machine.rounds[name] ?? 0) + 1;
  machine.submissions = {};
  const current: PhaseInfo = {
    name,
    id: machine.entered,
    round: machine.rounds[name] ?? 1,
    startedAt: at,
    endsAt: phase.seconds === undefined ? null : at + Math.round(phase.seconds * 1000),
  };
  machine.current = current;
  phase.start?.(kept.game, { ...gameContext(output, at, 0), phase: current });
}

// Ends the current phase at `at` and enters the one its end() names.
function endPhase(game: AnyGame, kept: Kept, at: number, output: Output): void {
  const machine = kept.phases;
  const current = machine.current;
  if (current === null) return;
  const phase = (phasesOf(game) ?? {})[current.name];
  const submissions = machine.submissions;
  machine.current = null;
  machine.submissions = {};
  const next = phase?.end?.(kept.game, {
    ...gameContext(output, at, 0),
    phase: current,
    submissions,
  });
  if (typeof next === 'string') enterPhase(game, kept, next, at, output);
}

// Ends every phase whose deadline is due at `now`, each at its own deadline: a phase's window
// includes its start and excludes its deadline, and what was due happens before the operation at
// `now`.
function settle(game: AnyGame, kept: Kept, now: number, output: Output): void {
  for (let changes = 0; ; changes++) {
    const current = kept.phases.current;
    if (current === null || current.endsAt === null || current.endsAt > now || output.finished) {
      return;
    }
    if (changes >= maxPhaseChanges) {
      throw new Error('phases keep ending each other without time passing');
    }
    endPhase(game, kept, current.endsAt, output);
  }
}

function allSubmitted(kept: Kept): boolean {
  const { players, submissions } = kept.phases;
  return players.length > 0 && players.every((player) => player in submissions);
}

function phaseControls(game: AnyGame, kept: Kept, now: number, output: Output) {
  return {
    phase: kept.phases.current,
    endPhase() {
      endPhase(game, kept, now, output);
    },
  };
}

// A game without phases is never in one.
function noPhases() {
  return { phase: null, endPhase() {} };
}

// Whether the current phase allows a command: a command no phase mentions is allowed everywhere.
function allowedIn(
  phases: Record<string, PhaseDefinition>,
  current: PhaseInfo | null,
  name: string,
): boolean {
  const mentions = (phase: PhaseDefinition) =>
    phase.submit === name || (phase.accepts ?? []).includes(name);
  if (!Object.values(phases).some(mentions)) return true;
  const phase = current === null ? undefined : phases[current.name];
  return phase !== undefined && mentions(phase);
}

export function __playhoot_start(game: AnyGame, participants: string[]) {
  const state = game.setup(participants);
  const phases = phasesOf(game);
  if (phases === null) return { state };
  const kept: Kept = {
    game: state,
    phases: { current: null, entered: 0, rounds: {}, submissions: {}, players: [...participants] },
  };
  const output = newOutput();
  const first = (game.firstPhase as string | undefined) ?? Object.keys(phases)[0] ?? '';
  enterPhase(game, kept, first, 0, output);
  return result(kept, output);
}

export function __playhoot_command(
  game: AnyGame,
  state: unknown,
  command: { participant: string; name: string; payload: unknown; sessionTime: number },
  context: SandboxContext,
) {
  const output = newOutput();
  const now = command.sessionTime;
  const handler = (game.on as Record<string, (s: unknown, c: unknown) => unknown> | undefined)?.[
    command.name
  ];
  const phases = phasesOf(game);
  if (phases === null) {
    if (handler === undefined) {
      throw new Error(`the game has no handler for command ${command.name}`);
    }
    const answer = handler(state, {
      ...gameContext(output, now, context.elapsed),
      ...noPhases(),
      player: command.participant,
      payload: command.payload,
    });
    return result(state, output, { response: answerOf(answer) });
  }

  const kept = state as Kept;
  settle(game, kept, now, output);
  if (output.finished) return result(kept, output, { response: { ok: false, code: 'GAME_OVER' } });
  const current = kept.phases.current;
  if (!allowedIn(phases, current, command.name)) {
    return result(kept, output, { response: { ok: false, code: 'WRONG_PHASE' } });
  }
  const payload = command.payload as Record<string, unknown> | null;
  if (typeof payload?.phase === 'number' && payload.phase !== current?.id) {
    return result(kept, output, { response: { ok: false, code: 'STALE_PHASE' } });
  }
  const phase = current === null ? undefined : phases[current.name];
  const submits = phase?.submit === command.name;
  if (submits && phase?.lock === true && command.participant in kept.phases.submissions) {
    return result(kept, output, { response: { ok: false, code: 'ALREADY_SUBMITTED' } });
  }
  if (handler === undefined && !submits) {
    throw new Error(`the game has no handler for command ${command.name}`);
  }
  const answer = handler?.(kept.game, {
    ...gameContext(output, now, context.elapsed),
    ...phaseControls(game, kept, now, output),
    player: command.participant,
    payload: command.payload,
  });
  // The handler may refuse the submission, end the phase or the game: then nothing is recorded.
  if (
    submits &&
    !isRejection(answer) &&
    kept.phases.current?.id === current?.id &&
    !output.finished
  ) {
    kept.phases.submissions[command.participant] = command.payload;
    if (phase?.untilAllSubmit !== false && allSubmitted(kept)) endPhase(game, kept, now, output);
  }
  return result(kept, output, { response: answerOf(answer) });
}

export function __playhoot_samples(
  game: AnyGame,
  state: unknown,
  transitions: { participant: string; inputs: unknown; sessionTime: number }[],
  context: SandboxContext,
) {
  const output = newOutput();
  const kept = phasesOf(game) === null ? null : (state as Kept);
  for (const transition of transitions) {
    if (kept !== null) settle(game, kept, transition.sessionTime, output);
    if (output.finished) break;
    game.input?.(kept === null ? state : kept.game, {
      ...gameContext(output, transition.sessionTime, context.elapsed),
      ...(kept === null ? noPhases() : phaseControls(game, kept, transition.sessionTime, output)),
      player: transition.participant,
      inputs: transition.inputs as never,
    });
  }
  return result(state, output);
}

export function __playhoot_update(game: AnyGame, state: unknown, context: SandboxContext) {
  const output = newOutput();
  const now = context.sessionTime;
  const kept = phasesOf(game) === null ? null : (state as Kept);
  if (kept !== null) settle(game, kept, now, output);
  if (!output.finished) {
    game.update?.(kept === null ? state : kept.game, {
      ...gameContext(output, now, context.elapsed),
      ...(kept === null ? noPhases() : phaseControls(game, kept, now, output)),
    });
  }
  return result(state, output);
}

export function __playhoot_player_disconnected(
  game: AnyGame,
  state: unknown,
  participant: string,
  context: SandboxContext,
) {
  const output = newOutput();
  const now = context.sessionTime;
  const kept = phasesOf(game) === null ? null : (state as Kept);
  if (kept !== null) settle(game, kept, now, output);
  game.leave?.(kept === null ? state : kept.game, {
    ...gameContext(output, now, context.elapsed),
    player: participant,
  });
  if (kept !== null && !output.finished) {
    kept.phases.players = kept.phases.players.filter((player) => player !== participant);
    const current = kept.phases.current;
    const phase = current === null ? undefined : (phasesOf(game) ?? {})[current.name];
    if (phase?.submit !== undefined && phase.untilAllSubmit !== false && allSubmitted(kept)) {
      endPhase(game, kept, now, output);
    }
  }
  return result(state, output);
}

export function __playhoot_player_rejoined(
  game: AnyGame,
  state: unknown,
  participant: string,
  context: SandboxContext,
) {
  const output = newOutput();
  const now = context.sessionTime;
  const kept = phasesOf(game) === null ? null : (state as Kept);
  if (kept !== null) settle(game, kept, now, output);
  const accepted =
    game.rejoin?.(kept === null ? state : kept.game, {
      ...gameContext(output, now, context.elapsed),
      player: participant,
    }) ?? false;
  if (kept !== null && accepted === true && !kept.phases.players.includes(participant)) {
    kept.phases.players.push(participant);
  }
  return result(state, output, { accepted: accepted === true });
}

// A view never advances time: a phase whose deadline passed but that no operation has ended yet
// shows 0 seconds left.
export function __playhoot_project(
  game: AnyGame,
  state: unknown,
  participant: string,
  context: SandboxContext,
) {
  const now = context.sessionTime;
  if (phasesOf(game) === null) {
    return game.view(state, participant, { now, phase: null, submitted: [], mine: null });
  }
  const kept = state as Kept;
  const current = kept.phases.current;
  const submitted = Object.keys(kept.phases.submissions);
  const mine = kept.phases.submissions[participant] ?? null;
  const view: unknown = game.view(kept.game, participant, {
    now,
    phase: current,
    submitted,
    mine,
  });
  if (typeof view !== 'object' || view === null || Array.isArray(view)) {
    throw new Error('with phases, view() must return an object: the platform adds `phase` to it');
  }
  return {
    ...view,
    phase:
      current === null
        ? null
        : {
            name: current.name,
            id: current.id,
            round: current.round,
            // Whole seconds, so the view changes once a second, not on every tick.
            secondsLeft:
              current.endsAt === null
                ? null
                : Math.max(0, Math.ceil((current.endsAt - now) / 1000)),
            submitted,
            mine,
          },
  };
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
  // update() also runs the phases' deadlines.
  if (game.update !== undefined || phasesOf(game) !== null) entrypoints.push('update');
  if (game.rejoin !== undefined) entrypoints.push('playerRejoined');
  return {
    schema_version: 1,
    players: { min: game.players.min, max: game.players.max },
    inputs: manifestFields((game.inputs ?? {}) as Fields),
    commands,
    entrypoints,
  };
}
