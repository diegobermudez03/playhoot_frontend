# Recipe: Number Guess

A turn-based game with private information. Players take turns guessing a secret number from 1 to 100; each guess gets a hint; a turn lasts 15 seconds. It shows commands with fields, `reject` and `error`, `emit`, a turn clock in `update`, `leave` and `rejoin`, helpers in another server file, and a view that hides the secret until the end.

## shared/actions.ts

`guess` carries a number from 1 to 100: the platform refuses anything else before the handler runs. The view's `secret` stays `null` until someone finds it.

<!-- example: fixtures/sdk-games/number-guess/shared/actions.ts -->
```ts
import { defineCommands } from '@playhoot/game-core';

// What players may ask the server to do, and the fields each request carries.
export const commands = defineCommands({
  guess: { value: { type: 'number', min: 1, max: 100, default: 50 } },
  pass: {},
});

// What one player sees. The secret is null until the game ends.
export type View = {
  me: string;
  turn: string | null;
  secondsLeft: number;
  guesses: { player: string; value: number; hint: 'higher' | 'lower' | 'correct' }[];
  winner: string | null;
  secret: number | null;
};
```

## server/turns.ts

Server helpers live in their own file. Top-level code is only a constant, a type and functions.

<!-- example: fixtures/sdk-games/number-guess/server/turns.ts -->
```ts
// Turn order helpers. Plain functions over plain data: the only kind of top-level code allowed.

export const TURN_MS = 15000;

export type Turns = { order: string[]; current: number; endsAt: number };

export function firstTurn(players: string[]): Turns {
  return { order: [...players], current: 0, endsAt: TURN_MS };
}

export function playerToMove(turns: Turns): string | null {
  return turns.order[turns.current] ?? null;
}

// Moves to the next player and restarts the turn clock from `now`.
export function advance(turns: Turns, now: number): void {
  turns.current = turns.order.length === 0 ? 0 : (turns.current + 1) % turns.order.length;
  turns.endsAt = now + TURN_MS;
}

// Takes a player out of the order, keeping the turn with whoever was next.
export function remove(turns: Turns, player: string): void {
  const index = turns.order.indexOf(player);
  if (index < 0) return;
  turns.order.splice(index, 1);
  if (index < turns.current) turns.current -= 1;
  if (turns.current >= turns.order.length) turns.current = 0;
}
```

## server/game.ts

- `setup` draws the secret with `Math.random()`: seeded, so a scenario with the same seed draws the same number.
- `guess` checks the turn **before** changing anything, then records the guess, emits an event and answers the hint to the sender.
- `pass` shows `error` (a message to one player) together with `reject` (the command's answer).
- `update` moves the turn when its clock runs out; the clock is `endsAt` in the state.
- `leave` takes the player out of the turn order; `rejoin` puts them back.
- `view` never sends the secret while the game runs.

<!-- example: fixtures/sdk-games/number-guess/server/game.ts -->
```ts
import { defineGame, reject } from '@playhoot/game-server';

import { commands, type View } from '../shared/actions';
import { advance, firstTurn, playerToMove, remove, type Turns } from './turns';

// Players take turns guessing a secret number from 1 to 100; each guess gets a hint.
// A turn lasts 15 seconds. The secret stays on the server until someone finds it.

type Guess = View['guesses'][number];
type State = { secret: number; turns: Turns; guesses: Guess[]; winner: string | null };

export default defineGame({
  players: { min: 2, max: 6 },
  commands,
  setup: (players): State => ({
    // Math.random is seeded by the platform, so a scenario with the same seed repeats.
    secret: 1 + Math.floor(Math.random() * 100),
    turns: firstTurn(players),
    guesses: [],
    winner: null,
  }),
  on: {
    guess(state, { player, payload, now, emit, finish }) {
      // Validate first: changes made before a rejection are kept.
      if (playerToMove(state.turns) !== player) return reject('NOT_YOUR_TURN');
      const hint =
        payload.value === state.secret
          ? 'correct'
          : payload.value < state.secret
            ? 'higher'
            : 'lower';
      state.guesses.push({ player, value: payload.value, hint });
      emit({ type: 'guessed', player, hint });
      if (hint === 'correct') {
        state.winner = player;
        finish();
        return { hint };
      }
      advance(state.turns, now);
      return { hint };
    },
    pass(state, { player, now, error }) {
      if (playerToMove(state.turns) !== player) {
        error(player, { code: 'NOT_YOUR_TURN' });
        return reject('NOT_YOUR_TURN');
      }
      advance(state.turns, now);
    },
  },
  // Runs about every 100 ms: the turn clock lives in the state and is checked here.
  update(state, { now }) {
    if (now >= state.turns.endsAt) advance(state.turns, now);
  },
  leave(state, { player }) {
    remove(state.turns, player);
  },
  rejoin(state, { player }) {
    if (state.turns.order.includes(player)) return true;
    state.turns.order.push(player);
    return true;
  },
  view: (state, player, { now }): View => ({
    me: player,
    turn: playerToMove(state.turns),
    secondsLeft: Math.max(0, Math.ceil((state.turns.endsAt - now) / 1000)),
    guesses: state.guesses,
    winner: state.winner,
    secret: state.winner === null ? null : state.secret,
  }),
});
```

## client/Game.tsx

- `TextAnswer` holds what the player types and sends it with Enter or its button; it keeps the text when the answer is a refusal.
- The answer of `guess` tells whether the server refused it (`result.ok === false`, with `result.code`).
- The game state comes only from the view; local UI state (`useState`) holds only the last refusal.

<!-- example: fixtures/sdk-games/number-guess/client/Game.tsx -->
```tsx
import { Button, Screen, Stack, Text, TextAnswer, useCommand, useView } from '@playhoot/game-react';
import { useState } from 'react';

import { commands, type View } from '../shared/actions';

export default function Game() {
  const view = useView<View>();
  const guess = useCommand(commands.guess);
  const pass = useCommand(commands.pass);
  const [refusal, setRefusal] = useState<string | null>(null);
  if (view === null) return null;

  const myTurn = view.turn === view.me && view.winner === null;
  const send = async (text: string) => {
    const result = await guess({ value: Number(text) });
    setRefusal(result.ok ? null : result.code);
    return result;
  };
  return (
    <Screen theme={{ background: '#1d3557', surface: '#2b4a75' }}>
      <Text size="xl">
        {view.winner === null
          ? `${view.turn === view.me ? 'Your turn' : `${view.turn}'s turn`} · ${view.secondsLeft}s`
          : `${view.winner === view.me ? 'You' : view.winner} found ${view.secret}`}
      </Text>
      <Stack direction="row" align="end">
        <Stack grow>
          <TextAnswer
            label="A number from 1 to 100"
            onSubmit={send}
            submitLabel="Guess"
            disabled={!myTurn}
          />
        </Stack>
        <Button tone="surface" onPress={pass} disabled={!myTurn}>
          Pass
        </Button>
      </Stack>
      {refusal !== null && <Text tone="negative">Refused: {refusal}</Text>}
      <Stack gap="sm">
        {view.guesses.map((entry, index) => (
          <Text key={index}>
            {entry.player}: {entry.value} → {entry.hint}
          </Text>
        ))}
      </Stack>
    </Screen>
  );
}
```

## scenarios/two-players.json

P1 guesses on its turn, then tries again out of turn (refused with `NOT_YOUR_TURN`), then P2 passes; the expectations check one guess counted, its hint, that the secret stays hidden in the views, and whose turn it is.

<!-- example: fixtures/sdk-games/number-guess/scenarios/two-players.json -->
```json
{
  "format": "playhoot.scenario.v1",
  "players": 2,
  "seed": 7,
  "duration_ms": 40000,
  "steps": [
    {
      "at_ms": 500,
      "player": "P1",
      "command": {
        "name": "guess",
        "payload": {
          "value": 50
        }
      }
    },
    {
      "at_ms": 600,
      "player": "P1",
      "command": {
        "name": "guess",
        "payload": {
          "value": 60
        }
      }
    },
    {
      "at_ms": 1000,
      "player": "P2",
      "command": {
        "name": "pass"
      }
    }
  ],
  "observe_at_ms": [700, 20000],
  "expect": [
    {
      "at_ms": 700,
      "path": "guesses",
      "op": "len",
      "value": 1
    },
    {
      "at_ms": 700,
      "path": "guesses[0].hint",
      "op": "eq",
      "value": "lower"
    },
    {
      "at_ms": 700,
      "of": "P1",
      "path": "secret",
      "op": "eq",
      "value": null
    },
    {
      "at_ms": 700,
      "of": "P2",
      "path": "turn",
      "op": "eq",
      "value": "P2"
    },
    {
      "path": "winner",
      "op": "eq",
      "value": null
    }
  ]
}
```
