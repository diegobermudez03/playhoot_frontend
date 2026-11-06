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

## `scenarios/first-to-goal.json`

P1 taps twenty times and wins; P2 taps once. The expectations check the count a second in, what P2 sees, the winner and the final taps.

```json
{
  "format": "playhoot.scenario.v1",
  "players": 2,
  "seed": 1,
  "duration_ms": 31000,
  "steps": [
    {
      "at_ms": 150,
      "player": "P1",
      "command": {
        "name": "tap"
      }
    },
    {
      "at_ms": 300,
      "player": "P1",
      "command": {
        "name": "tap"
      }
    },
    {
      "at_ms": 450,
      "player": "P1",
      "command": {
        "name": "tap"
      }
    },
    {
      "at_ms": 600,
      "player": "P1",
      "command": {
        "name": "tap"
      }
    },
    {
      "at_ms": 750,
      "player": "P1",
      "command": {
        "name": "tap"
      }
    },
    {
      "at_ms": 900,
      "player": "P1",
      "command": {
        "name": "tap"
      }
    },
    {
      "at_ms": 1050,
      "player": "P1",
      "command": {
        "name": "tap"
      }
    },
    {
      "at_ms": 1200,
      "player": "P1",
      "command": {
        "name": "tap"
      }
    },
    {
      "at_ms": 1350,
      "player": "P1",
      "command": {
        "name": "tap"
      }
    },
    {
      "at_ms": 1500,
      "player": "P1",
      "command": {
        "name": "tap"
      }
    },
    {
      "at_ms": 1650,
      "player": "P1",
      "command": {
        "name": "tap"
      }
    },
    {
      "at_ms": 1800,
      "player": "P1",
      "command": {
        "name": "tap"
      }
    },
    {
      "at_ms": 1950,
      "player": "P1",
      "command": {
        "name": "tap"
      }
    },
    {
      "at_ms": 2100,
      "player": "P1",
      "command": {
        "name": "tap"
      }
    },
    {
      "at_ms": 2250,
      "player": "P1",
      "command": {
        "name": "tap"
      }
    },
    {
      "at_ms": 2400,
      "player": "P1",
      "command": {
        "name": "tap"
      }
    },
    {
      "at_ms": 2550,
      "player": "P1",
      "command": {
        "name": "tap"
      }
    },
    {
      "at_ms": 2700,
      "player": "P1",
      "command": {
        "name": "tap"
      }
    },
    {
      "at_ms": 2850,
      "player": "P1",
      "command": {
        "name": "tap"
      }
    },
    {
      "at_ms": 3000,
      "player": "P1",
      "command": {
        "name": "tap"
      }
    },
    {
      "at_ms": 500,
      "player": "P2",
      "command": {
        "name": "tap"
      }
    }
  ],
  "observe_at_ms": [1000],
  "expect": [
    {
      "at_ms": 1000,
      "path": "taps.P1",
      "op": "gte",
      "value": 5
    },
    {
      "at_ms": 1000,
      "of": "P2",
      "path": "me",
      "op": "eq",
      "value": "P2"
    },
    {
      "at_ms": 1000,
      "of": "P2",
      "path": "goal",
      "op": "eq",
      "value": 20
    },
    {
      "path": "winner",
      "op": "eq",
      "value": "P1"
    },
    {
      "path": "taps",
      "op": "eq",
      "value": {
        "P1": 20,
        "P2": 1
      }
    }
  ]
}
```
