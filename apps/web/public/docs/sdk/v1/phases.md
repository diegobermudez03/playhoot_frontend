# Phases, submissions and scores

For games that move through timed steps: ask, answer, reveal, results. Declare the phases and the platform runs their clocks, collects each player's private answer, and moves between them. You write what happens when a phase ends.

## Declaring phases

`phases` in `defineGame` maps each phase name to its rules. The first declared phase starts the game (or name it in `firstPhase`).

<!-- example: fixtures/sdk-games/quiz/server/game.ts -->
```ts
  phases: {
    question: {
      seconds: 20,
      submit: 'answer',
      end(state, { submissions }) {
        const correct = CORRECT[state.index];
        const counts = [0, 0, 0, 0];
        for (const [player, { option }] of Object.entries(submissions)) {
          counts[option] += 1;
          if (option === correct) addPoints(state.scores, player, 1);
        }
        state.reveal = { correct, counts };
        return 'reveal';
      },
    },
    reveal: {
      seconds: 5,
      end(state, { finish }) {
        state.reveal = null;
        state.index += 1;
        if (state.index < CORRECT.length) return 'question';
        finish();
        return 'results';
      },
    },
    results: {},
```

Each phase may have:

- `seconds`: its deadline, counted from when it starts. Without it the phase lasts until a handler calls `endPhase()` (or forever, like `results` above).
- `submit`: the command whose payload is each player's submission in this phase. It needs no handler: the platform records it. The last one a player sends counts, unless `lock: true` (then a second one is refused as `ALREADY_SUBMITTED`).
- `untilAllSubmit`: with `submit`, the phase ends as soon as every player still in the game has submitted. On by default; `false` keeps the clock.
- `accepts`: other commands allowed in this phase.
- `start(state, context)`: runs when the phase starts; `context.phase` tells which entry it is.
- `end(state, context)`: runs when the phase ends, with `context.submissions` (player → payload, only those who submitted). Copy into the state what may now be revealed, and return the next phase's name. Return nothing to stay without a phase; call `finish()` to end the game.

The submissions' type comes from the `submit` command: in the quiz, `submissions[player]` is `{ option: number; phase: number }`.

## Time

A phase's window includes its start and excludes its deadline: a command arriving exactly at the deadline is too late. Before any command, input, `update` or leave at time `t`, every phase whose deadline is at or before `t` ends first, each at its own deadline, so the next phase starts exactly when the previous one ended. A phase never ends inside `view`.

Games with phases always get `update` calls; declare `update` only for your own time-based rules. It runs after the due phases ended.

## Commands in phases

- A command that some phase lists (in `submit` or `accepts`) is refused in the other phases with `WRONG_PHASE`. A command no phase lists is allowed in every phase.
- **Recommended:** declare a `phase: 'number'` field in a command to protect it from arriving late: `useCommand` fills it with the current phase's `id`, and the platform refuses it as `STALE_PHASE` if the phase changed meanwhile (an answer meant for question 2 never counts for question 3).
- Handlers receive `phase` (the current phase or null) and `endPhase()`, which ends it at once.
- A handler of a `submit` command runs first; if it returns `reject(...)`, the submission is not recorded.

<!-- example: fixtures/sdk-games/quiz/shared/actions.ts -->
```ts
import { defineCommands, type PhaseView, type Standing } from '@playhoot/game-core';

// `phase` makes an answer sent for an earlier question arrive as STALE_PHASE instead of counting
// for the current one; useCommand fills it in.
export const commands = defineCommands({
  answer: { option: { type: 'number', min: 0, max: 3 }, phase: 'number' },
});

export type View = {
  // Which question is asked (1-based); its text is in shared/questions.ts, in the player's language.
  question: { number: number } | null;
  // Shown only once the question ended.
  reveal: { correct: number; counts: number[] } | null;
  standings: Standing[];
  total: number;
  phase: PhaseView<'question' | 'reveal' | 'results', { option: number }> | null;
};
```

## Privacy

Submissions are kept by the platform, outside your state, until the phase ends. `view` receives `submitted` (who has submitted) and `mine` (this player's own submission), never another player's. Nothing leaks unless `end` copies it into the state.

## What the view carries

With phases, `view` must return an object: the platform adds `phase` to it.

- `name`, `id` (every phase entered counts; used for `STALE_PHASE`), `round` (how many times this phase has been entered, from 1).
- `secondsLeft`: whole seconds left, rounded up, or null without a deadline. It comes from the server and changes once a second; the client has no clock of the game.
- `submitted` and `mine`, as above.

The type is `PhaseView<Name, Submission>` from `@playhoot/game-core`. In the client, `usePhase()` returns it (`client.md`).

## Scores

`Scores` is a plain object in your state, player → points. `addPoints(scores, player, points)` adds (or subtracts), `ranking(scores, players)` orders them: best first, tied players share a rank and the next rank skips (1, 1, 3), listed players without points count 0. Both come from `@playhoot/game-server` (and `ranking` from `@playhoot/game-react` too, for the client).

<!-- example: fixtures/sdk-games/quiz/server/game.ts -->
```ts
  view: (state): Omit<View, 'phase'> => ({
    question: state.index < CORRECT.length ? { number: state.index + 1 } : null,
    reveal: state.reveal,
    standings: ranking(state.scores, state.players),
    total: CORRECT.length,
  }),
```

## When the game ends

`finish()` ends the game after the current operation. Each player's last view is the final one, and their screen keeps showing it, with a notice that the game is over, until they leave. **Recommended:** make the last phase a results screen, as the quiz's `results` is.

See `examples/quiz.md` and `examples/know-me.md`.
