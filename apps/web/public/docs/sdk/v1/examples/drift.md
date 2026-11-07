# Example: Drift

An example to learn the SDK from, every file explained. Do not copy it as the start of a game: start from a template (`policies.md`), or from the starter project.

A movement game for 1 to 6 players: each player holds arrows to move; touching the star scores; the first to 3 stars wins. It shows continuous inputs, movement integrated in `update`, and world units scaled by the client.

## `game.project.json`

<!-- example: fixtures/sdk-games/drift/game.project.json -->
```json
{
  "format": "playhoot.project.v1",
  "languages": [
    "en"
  ],
  "aspectRatio": "16:9"
}
```

## `shared/actions.ts`

`move` is a `vector2` the player holds. The arena is in world units both sides share; the client scales them to the screen.

<!-- example: fixtures/sdk-games/drift/shared/actions.ts -->
```ts
import { defineInputs } from '@playhoot/game-core';

// The arena's size in world units; the client scales it to the screen.
export const ARENA = { width: 160, height: 90 };

// Each player holds a direction; the server moves them while they hold it.
export const inputs = defineInputs({
  move: 'vector2',
});

export type View = {
  me: string;
  positions: Record<string, [number, number]>;
  star: [number, number];
  scores: Record<string, number>;
  winner: string | null;
};
```

## `server/game.ts`

- `input` only records what each player holds; it runs on every change of a snapshot.
- `update` moves everyone by `direction × SPEED × elapsed`, so movement does not depend on how often steps run.
- Catching the star emits an event and moves the star; 3 stars finish the game.

<!-- example: fixtures/sdk-games/drift/server/game.ts -->
```ts
import { defineGame } from '@playhoot/game-server';

import { ARENA, inputs, type View } from '../shared/actions';

// Move with the arrows; touching the star scores; the first to 3 stars wins.
const SPEED = 40;
const REACH = 6;
const GOAL = 3;

type State = {
  moves: Record<string, [number, number]>;
  positions: Record<string, [number, number]>;
  star: [number, number];
  scores: Record<string, number>;
  winner: string | null;
};

export default defineGame({
  players: { min: 1, max: 6 },
  inputs,
  setup: (players): State => ({
    moves: Object.fromEntries(players.map((player) => [player, [0, 0]])),
    positions: Object.fromEntries(
      players.map((player, i) => [player, [20 + i * 20, ARENA.height / 2]]),
    ),
    star: randomSpot(),
    scores: Object.fromEntries(players.map((player) => [player, 0])),
    winner: null,
  }),
  input(state, { player, inputs: held }) {
    state.moves[player] = held.move;
  },
  update(state, { elapsed, emit, finish }) {
    const seconds = elapsed / 1000;
    for (const [player, [dx, dy]] of Object.entries(state.moves)) {
      const position = state.positions[player];
      position[0] = clamp(position[0] + dx * SPEED * seconds, 0, ARENA.width);
      position[1] = clamp(position[1] + dy * SPEED * seconds, 0, ARENA.height);
      if (Math.hypot(position[0] - state.star[0], position[1] - state.star[1]) > REACH) continue;
      state.scores[player] += 1;
      state.star = randomSpot();
      emit({ caught: player });
      if (state.scores[player] >= GOAL) {
        state.winner = player;
        finish();
        return;
      }
    }
  },
  leave(state, { player }) {
    state.moves[player] = [0, 0];
  },
  view: (state, player): View => ({
    me: player,
    positions: state.positions,
    star: state.star,
    scores: state.scores,
    winner: state.winner,
  }),
});

function randomSpot(): [number, number] {
  return [10 + Math.random() * (ARENA.width - 20), 10 + Math.random() * (ARENA.height - 20)];
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}
```

## `client/Game.tsx`

The held arrows become one direction; `setInputs` sends it only when it changes. Positions are drawn as percentages of the arena.

<!-- example: fixtures/sdk-games/drift/client/Game.tsx -->
```tsx
import { useInputs, useView } from '@playhoot/game-react';
import { useEffect } from 'react';

import { ARENA, inputs, type View } from '../shared/actions';

const KEYS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

export default function Game() {
  const view = useView<View>();
  const [, setInputs] = useInputs(inputs);

  // The held arrows become one direction, sent whenever it changes.
  useEffect(() => {
    const held = new Set<string>();
    const send = () => {
      let x = 0;
      let y = 0;
      for (const key of held) {
        x += KEYS[key]?.[0] ?? 0;
        y += KEYS[key]?.[1] ?? 0;
      }
      setInputs({ move: [Math.sign(x), Math.sign(y)] });
    };
    const down = (event: KeyboardEvent) => {
      if (!(event.key in KEYS)) return;
      held.add(event.key);
      send();
    };
    const up = (event: KeyboardEvent) => {
      held.delete(event.key);
      send();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [setInputs]);

  if (view === null) return null;
  const at = ([x, y]: [number, number]) => ({
    left: `${(x / ARENA.width) * 100}%`,
    top: `${(y / ARENA.height) * 100}%`,
  });
  return (
    <div style={styles.arena}>
      <div style={{ ...styles.star, ...at(view.star) }} />
      {Object.entries(view.positions).map(([player, position]) => (
        <div
          key={player}
          style={{ ...styles.ship, ...at(position), ...(player === view.me ? styles.mine : {}) }}
        >
          {view.scores[player]}
        </div>
      ))}
      {view.winner && <div style={styles.banner}>{view.winner} wins</div>}
    </div>
  );
}

const styles = {
  arena: { position: 'relative', height: '100%', background: '#0b132b', overflow: 'hidden' },
  star: {
    position: 'absolute',
    width: 48,
    height: 48,
    marginLeft: -24,
    marginTop: -24,
    borderRadius: '50%',
    background: '#ffd166',
  },
  ship: {
    position: 'absolute',
    width: 64,
    height: 64,
    marginLeft: -32,
    marginTop: -32,
    borderRadius: 16,
    background: '#5bc0be',
    color: '#0b132b',
    font: '800 32px system-ui, sans-serif',
    display: 'grid',
    placeItems: 'center',
  },
  mine: { background: '#ef476f', color: '#fff' },
  banner: {
    position: 'absolute',
    inset: 0,
    display: 'grid',
    placeItems: 'center',
    color: '#fff',
    font: '800 96px system-ui, sans-serif',
  },
} as const;
```

## `scenarios/one-player.json`

P1 holds right for one second (a `holds` segment, released to the neutral snapshot at its end); the expectations check that the position moved and that the move input is back to rest.

```json
{
  "format": "playhoot.scenario.v1",
  "players": 1,
  "seed": 5,
  "duration_ms": 4000,
  "observe_at_ms": [0, 1100, 3000],
  "holds": [
    {
      "from_ms": 100,
      "to_ms": 1100,
      "player": "P1",
      "inputs": {
        "move": [1, 0]
      }
    }
  ],
  "expect": [
    {
      "at_ms": 0,
      "path": "positions.P1",
      "op": "eq",
      "value": [20, 45]
    },
    {
      "at_ms": 1100,
      "path": "positions.P1[0]",
      "op": "gt",
      "value": 20
    },
    {
      "at_ms": 3000,
      "path": "moves.P1",
      "op": "eq",
      "value": [0, 0]
    },
    {
      "at_ms": 1100,
      "of": "P1",
      "path": "me",
      "op": "eq",
      "value": "P1"
    },
    {
      "path": "winner",
      "op": "eq",
      "value": null
    }
  ]
}
```
