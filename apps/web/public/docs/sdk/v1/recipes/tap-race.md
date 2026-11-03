# Recipe: Tap Race

The starter game every new project begins with. Every player taps a button; the first to 20 taps wins, or whoever leads after 30 seconds. It shows the smallest complete game: one command, a deadline in `update`, `finish`, and a view per player.

## game.project.json

<!-- example: fixtures/sdk-games/tap-race/game.project.json -->
```json
{
  "format": "playhoot.project.v1",
  "languages": [
    "en"
  ],
  "aspectRatio": "16:9"
}
```

## shared/actions.ts

One command without fields, and the type of what each player sees.

<!-- example: fixtures/sdk-games/tap-race/shared/actions.ts -->
```ts
import { defineCommands } from '@playhoot/game-core';

export const commands = defineCommands({ tap: {} });

export type View = {
  me: string;
  taps: Record<string, number>;
  goal: number;
  secondsLeft: number;
  winner: string | null;
};
```

## server/game.ts

- `setup` builds the initial state from the participant ids.
- `tap` changes the state in place and calls `finish()` when someone reaches the goal.
- `update` runs about every 100 ms; the 30-second deadline is checked against `now`, the Session time.
- `view` returns the same information to everyone, plus who is asking (`me`).
- `leader` is a plain top-level function: allowed. `GOAL` and `DURATION_MS` are top-level constants of literals: allowed.

<!-- example: fixtures/sdk-games/tap-race/server/game.ts -->
```ts
import { defineGame } from '@playhoot/game-server';

import { commands, type View } from '../shared/actions';

// First to GOAL taps wins; when time runs out, whoever leads.
const GOAL = 20;
const DURATION_MS = 30000;

type State = { taps: Record<string, number>; winner: string | null };

export default defineGame({
  players: { min: 1, max: 8 },
  commands,
  setup: (players): State => ({
    taps: Object.fromEntries(players.map((player) => [player, 0])),
    winner: null,
  }),
  on: {
    tap(state, { player, finish }) {
      state.taps[player] += 1;
      if (state.taps[player] >= GOAL) {
        state.winner = player;
        finish();
      }
    },
  },
  update(state, { now, finish }) {
    if (now < DURATION_MS) return;
    state.winner = leader(state);
    finish();
  },
  view: (state, player, { now }): View => ({
    me: player,
    taps: state.taps,
    goal: GOAL,
    secondsLeft: Math.max(0, Math.ceil((DURATION_MS - now) / 1000)),
    winner: state.winner,
  }),
});

function leader(state: State): string | null {
  let best: string | null = null;
  for (const [player, taps] of Object.entries(state.taps)) {
    if (best === null || taps > state.taps[best]) best = player;
  }
  return best;
}
```

## client/Game.tsx

- `useView` gives the current view (null before the first one).
- `useCommand(commands.tap)` returns a function sending the command; it takes no argument because `tap` has no fields.
- `Screen` is the whole game area (theme, legible text, padding off the device edges); `Stack` lays out rows and columns; `Button` is the tap target (`ui.md`).

<!-- example: fixtures/sdk-games/tap-race/client/Game.tsx -->
```tsx
import { Button, Screen, Stack, Text, useCommand, usePlayer, useView } from '@playhoot/game-react';

import { commands, type View } from '../shared/actions';

export default function Game() {
  const view = useView<View>();
  const { players } = usePlayer();
  const tap = useCommand(commands.tap);
  if (view === null) return null;

  const done = view.winner !== null;
  return (
    <Screen theme={{ background: '#14213d', accent: '#fca311' }}>
      <Stack direction="row" justify="between">
        <Text>Goal: {view.goal}</Text>
        <Text>{done ? 'Finished' : `${view.secondsLeft}s`}</Text>
      </Stack>
      <Stack direction="row" grow>
        <Button onPress={tap} disabled={done} style={{ flex: 2, fontSize: '15vmin' }}>
          {done ? (view.winner === view.me ? 'You win!' : 'Game over') : (view.taps[view.me] ?? 0)}
        </Button>
        <Stack gap="sm" style={{ flex: 1 }}>
          {players.map((player) => (
            <Text key={player} tone={player === view.me ? 'accent' : undefined}>
              {player === view.me ? 'You' : player}: {view.taps[player] ?? 0}
              {view.winner === player ? ' 🏆' : ''}
            </Text>
          ))}
        </Stack>
      </Stack>
    </Screen>
  );
}
```
