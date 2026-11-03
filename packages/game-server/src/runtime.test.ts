import { defineCommands } from '@playhoot/game-core';
import { describe, expect, it } from 'vitest';

import { defineGame, reject } from './index';
import {
  __playhoot_command,
  __playhoot_manifest_of,
  __playhoot_player_disconnected,
  __playhoot_project,
  __playhoot_start,
  __playhoot_update,
} from './runtime';

const commands = defineCommands({
  vote: { option: 'number', phase: 'number' },
  ping: {},
  skip: {},
});

type State = { results: Record<string, number>[]; log: string[] };

function game(options: { lock?: boolean; untilAllSubmit?: boolean } = {}) {
  return defineGame({
    players: { min: 1, max: 4 },
    commands,
    setup: (): State => ({ results: [], log: [] }),
    phases: {
      vote: {
        seconds: 10,
        submit: 'vote',
        accepts: ['skip'],
        ...options,
        start(state, { phase }) {
          state.log.push(`start vote ${phase.round} at ${phase.startedAt}`);
        },
        end(state, { submissions, now }) {
          state.log.push(`end vote at ${now}`);
          state.results.push(
            Object.fromEntries(Object.entries(submissions).map(([p, s]) => [p, s.option])),
          );
          return state.results.length < 2 ? 'vote' : 'done';
        },
      },
      done: {},
    },
    on: {
      ping: () => 'pong',
      skip: (_state, { endPhase }) => endPhase(),
      vote: (_state, { payload }) => (payload.option < 0 ? reject('NEGATIVE') : undefined),
    },
    view: (state, player, { phase, submitted, mine }) => ({
      player,
      phase,
      submitted,
      mine,
      state,
    }),
  });
}

type Kept = {
  game: State;
  phases: { current: { name: string; id: number; endsAt: number | null } | null };
};

const at = (time: number) => ({ sessionTime: time, elapsed: 0 });
const send = (
  definition: ReturnType<typeof game>,
  state: unknown,
  player: string,
  name: string,
  payload: object,
  time: number,
) =>
  __playhoot_command(
    definition,
    state,
    { participant: player, name, payload, sessionTime: time },
    at(time),
  ) as {
    state: Kept;
    response: { ok: boolean; code?: string; value?: unknown };
    finished?: boolean;
  };
const tick = (definition: ReturnType<typeof game>, state: unknown, time: number) =>
  __playhoot_update(definition, state, at(time)) as { state: Kept; finished?: boolean };

describe('phases', () => {
  it('starts in the first phase with its deadline', () => {
    const { state } = __playhoot_start(game(), ['P1', 'P2']) as { state: Kept };
    expect(state.phases.current).toMatchObject({ name: 'vote', id: 1, endsAt: 10000 });
    expect(state.game.log).toEqual(['start vote 1 at 0']);
  });

  it('includes the start and excludes the deadline of a window', () => {
    const definition = game();
    const { state } = __playhoot_start(definition, ['P1', 'P2']) as { state: Kept };
    expect(send(definition, state, 'P1', 'vote', { option: 1, phase: 1 }, 9999).response.ok).toBe(
      true,
    );
    // At the deadline the phase already ended: the vote counts for the next round, which is phase 2.
    const late = send(
      definition,
      structuredClone(state),
      'P1',
      'vote',
      { option: 1, phase: 1 },
      10000,
    );
    expect(late.response).toEqual({ ok: false, code: 'STALE_PHASE' });
    expect(late.state.game.log).toEqual([
      'start vote 1 at 0',
      'end vote at 10000',
      'start vote 2 at 10000',
    ]);
  });

  it('ends each due phase at its own deadline before the operation', () => {
    const definition = game();
    const { state } = __playhoot_start(definition, ['P1']) as { state: Kept };
    const later = tick(definition, state, 25000);
    expect(later.state.game.log).toEqual([
      'start vote 1 at 0',
      'end vote at 10000',
      'start vote 2 at 10000',
      'end vote at 20000',
    ]);
    expect(later.state.phases.current).toMatchObject({ name: 'done', endsAt: null });
  });

  it('ends early when everyone still playing submitted, and keeps submissions private', () => {
    const definition = game();
    let { state } = __playhoot_start(definition, ['P1', 'P2', 'P3']) as { state: Kept };
    state = send(definition, state, 'P1', 'vote', { option: 3, phase: 1 }, 100).state;
    const forP2 = __playhoot_project(definition, state, 'P2', at(200)) as {
      mine: unknown;
      submitted: string[];
      state: State;
      phase: { secondsLeft: number; mine: unknown };
    };
    expect(forP2.submitted).toEqual(['P1']);
    expect(forP2.mine).toBeNull();
    expect(JSON.stringify(forP2)).not.toContain('"option":3');
    expect(forP2.phase.secondsLeft).toBe(10);
    const forP1 = __playhoot_project(definition, state, 'P1', at(200)) as { mine: unknown };
    expect(forP1.mine).toEqual({ option: 3, phase: 1 });

    state = __playhoot_player_disconnected(definition, state, 'P3', at(300)).state as Kept;
    state = send(definition, state, 'P2', 'vote', { option: 2, phase: 1 }, 400).state;
    expect(state.game.results).toEqual([{ P1: 3, P2: 2 }]);
    expect(state.phases.current).toMatchObject({ name: 'vote', id: 2, endsAt: 10400 });
  });

  it('keeps the last submission, or refuses a second one when locked', () => {
    const open = game();
    let { state } = __playhoot_start(open, ['P1', 'P2']) as { state: Kept };
    state = send(open, state, 'P1', 'vote', { option: 1, phase: 1 }, 100).state;
    state = send(open, state, 'P1', 'vote', { option: 2, phase: 1 }, 200).state;
    expect(tick(open, state, 10000).state.game.results).toEqual([{ P1: 2 }]);

    const locked = game({ lock: true });
    let kept = (__playhoot_start(locked, ['P1', 'P2']) as { state: Kept }).state;
    kept = send(locked, kept, 'P1', 'vote', { option: 1, phase: 1 }, 100).state;
    expect(send(locked, kept, 'P1', 'vote', { option: 2, phase: 1 }, 200).response).toEqual({
      ok: false,
      code: 'ALREADY_SUBMITTED',
    });
  });

  it('records nothing a handler rejects, and refuses commands of other phases', () => {
    const definition = game();
    const { state } = __playhoot_start(definition, ['P1']) as { state: Kept };
    const refused = send(definition, state, 'P1', 'vote', { option: -1, phase: 1 }, 100);
    expect(refused.response).toEqual({ ok: false, code: 'NEGATIVE' });
    expect(refused.state.phases.current?.id).toBe(1);

    const done = tick(definition, state, 20000).state;
    expect(send(definition, done, 'P1', 'skip', {}, 20001).response).toEqual({
      ok: false,
      code: 'WRONG_PHASE',
    });
    // A command no phase mentions is allowed in every phase.
    expect(send(definition, done, 'P1', 'ping', {}, 20002).response).toEqual({
      ok: true,
      value: 'pong',
    });
  });

  it('lets a handler end the phase now', () => {
    const definition = game();
    const { state } = __playhoot_start(definition, ['P1', 'P2']) as { state: Kept };
    const skipped = send(definition, state, 'P1', 'skip', {}, 3000).state;
    expect(skipped.game.log).toContain('end vote at 3000');
    expect(skipped.phases.current).toMatchObject({ id: 2, endsAt: 13000 });
  });

  it('runs deadlines through update and declares it in the manifest', () => {
    expect(__playhoot_manifest_of(game()).entrypoints).toEqual(['update']);
  });

  it('refuses phases that end each other without time passing', () => {
    const looping = defineGame({
      players: { min: 1, max: 1 },
      setup: () => ({}),
      phases: { a: { seconds: 0, end: () => 'b' }, b: { seconds: 0, end: () => 'a' } },
      view: () => ({}),
    });
    const { state } = __playhoot_start(looping, ['P1']);
    expect(() => __playhoot_update(looping, state, at(1))).toThrow(/without time passing/);
  });
});

describe('phase typing', () => {
  it('refuses a submit command the game does not declare', () => {
    const definition = defineGame({
      players: { min: 1, max: 1 },
      commands,
      setup: () => ({}),
      // @ts-expect-error `votes` is not a declared command.
      phases: { a: { submit: 'votes' } },
      view: () => ({}),
    });
    expect(definition.phases).toBeDefined();
  });
});
