# Example: Pairs

An example to learn the SDK from, every file explained. Do not copy it as the start of a game: start from a template (`policies.md`), or from the starter project.

A memory game for 1 to 4 players. Players take turns turning two cards: a pair scores and the player goes again, a miss passes the turn. It shows an optional image asset with a fallback, hiding information in the view, and the server's events and errors reaching the client.

## `game.project.json`

The card back is optional: the game works with a plain color until someone uploads it.

<!-- example: fixtures/sdk-games/pairs/game.project.json -->
```json
{
  "format": "playhoot.project.v1",
  "languages": [
    "en"
  ],
  "aspectRatio": "16:9",
  "assets": {
    "cardBack": {
      "type": "image",
      "description": "Back of a face-down card, square, 512x512",
      "optional": true
    }
  }
}
```

## `shared/actions.ts`

`flip` carries the card's index, bounded by the declaration: the client refuses `{ index: 9 }` before sending (`invalid_payload`). The event and error types are shared so both sides agree on them.

<!-- example: fixtures/sdk-games/pairs/shared/actions.ts -->
```ts
import { defineCommands } from '@playhoot/game-core';

export const CARDS = 8;

export const commands = defineCommands({
  flip: { index: { type: 'number', min: 0, max: 7 } },
});

// A card as one player sees it: its symbol only once it is face up or matched.
export type CardView = { state: 'hidden' | 'open' | 'matched'; symbol: string | null };

export type View = {
  me: string;
  turn: string | null;
  cards: CardView[];
  scores: Record<string, number>;
  winner: string | null;
};

// What emit() sends everyone after a second card is turned.
export type PairEvent = { kind: 'match' | 'miss'; player: string };

// What error() sends a player who flips out of turn.
export type PairError = { code: 'not_your_turn' };
```

## `server/game.ts`

- The deck is shuffled in `setup` with `Math.random()`, seeded per Session.
- Flipping out of turn sends the player an `error()` and refuses the command.
- After a second card, `emit()` tells everyone whether it was a pair.
- `view` gives a card's symbol only when it is face up or matched: the deck never reaches the client.

<!-- example: fixtures/sdk-games/pairs/server/game.ts -->
```ts
import { defineGame, reject } from '@playhoot/game-server';

import { CARDS, commands, type View } from '../shared/actions';

// Players take turns turning two cards; a pair scores and plays again, a miss passes the turn.
const SYMBOLS = ['sun', 'moon', 'star', 'leaf'];

type State = {
  symbols: string[];
  matched: boolean[];
  open: number[];
  turns: string[];
  turn: number;
  scores: Record<string, number>;
  winner: string | null;
};

export default defineGame({
  players: { min: 1, max: 4 },
  commands,
  setup: (players): State => ({
    symbols: shuffle([...SYMBOLS, ...SYMBOLS]),
    matched: Array.from({ length: CARDS }, () => false),
    open: [],
    turns: players,
    turn: 0,
    scores: Object.fromEntries(players.map((player) => [player, 0])),
    winner: null,
  }),
  on: {
    flip(state, { player, payload, emit, error, finish }) {
      if (state.turns[state.turn] !== player) {
        error(player, { code: 'not_your_turn' });
        return reject('NOT_YOUR_TURN');
      }
      const index = payload.index;
      if (state.matched[index] || state.open.includes(index)) return reject('ALREADY_FACE_UP');
      if (state.open.length === 2) state.open = [];
      state.open.push(index);
      if (state.open.length < 2) return;

      const [first, second] = state.open;
      if (state.symbols[first] === state.symbols[second]) {
        state.matched[first] = true;
        state.matched[second] = true;
        state.open = [];
        state.scores[player] += 1;
        emit({ kind: 'match', player });
        if (state.matched.every(Boolean)) {
          state.winner = leader(state);
          finish();
        }
        return;
      }
      emit({ kind: 'miss', player });
      state.turn = (state.turn + 1) % state.turns.length;
    },
  },
  leave(state, { player }) {
    const index = state.turns.indexOf(player);
    if (index < 0) return;
    state.turns.splice(index, 1);
    if (state.turn >= state.turns.length) state.turn = 0;
  },
  view: (state, player): View => ({
    me: player,
    turn: state.turns[state.turn] ?? null,
    cards: state.symbols.map((symbol, index) => {
      if (state.matched[index]) return { state: 'matched', symbol };
      if (state.open.includes(index)) return { state: 'open', symbol };
      return { state: 'hidden', symbol: null };
    }),
    scores: state.scores,
    winner: state.winner,
  }),
});

function shuffle(cards: string[]): string[] {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

function leader(state: State): string | null {
  let best: string | null = null;
  for (const [player, score] of Object.entries(state.scores)) {
    if (best === null || score > state.scores[best]) best = player;
  }
  return best;
}
```

## `client/Game.tsx`

- `AssetImage` draws the uploaded back once it is ready, and the `fallback` until then or when nobody uploaded it.
- `useGameEvent` and `useGameError` turn the server's moments into a short notice.
- Each card is a `Button` in a 4-column `Grid` (2 columns on a phone).

<!-- example: fixtures/sdk-games/pairs/client/Game.tsx -->
```tsx
import { assets } from '@playhoot/assets';
import {
  AssetImage,
  Button,
  Grid,
  Screen,
  Stack,
  Text,
  useCommand,
  useGameError,
  useGameEvent,
  useView,
} from '@playhoot/game-react';
import { useState } from 'react';

import { commands, type PairError, type PairEvent, type View } from '../shared/actions';

export default function Game() {
  const view = useView<View>();
  const flip = useCommand(commands.flip);
  const [notice, setNotice] = useState('');
  useGameEvent<PairEvent>((event) =>
    setNotice(event.kind === 'match' ? `${event.player} found a pair!` : `${event.player} missed`),
  );
  useGameError<PairError>(() => setNotice('Wait for your turn'));
  if (view === null) return null;

  return (
    <Screen theme={{ background: '#1d3557' }}>
      <Stack direction="row" justify="between">
        <Text>{view.winner ? `Winner: ${view.winner}` : `Turn: ${view.turn ?? '-'}`}</Text>
        <Text tone="accent">{notice}</Text>
      </Stack>
      <Grid columns={4}>
        {view.cards.map((card, index) => (
          <Button
            key={index}
            tone={card.state === 'matched' ? 'positive' : 'surface'}
            label={card.symbol ?? `Card ${index + 1}`}
            disabled={card.state !== 'hidden' || view.turn !== view.me}
            onPress={() => flip({ index })}
            style={{ height: '32vmin', padding: 0, overflow: 'hidden', fontSize: '10vmin' }}
          >
            {card.state !== 'hidden' ? (
              card.symbol
            ) : (
              <AssetImage
                asset={assets.cardBack}
                alt=""
                fit="cover"
                fallback={<Text tone="accent">?</Text>}
              />
            )}
          </Button>
        ))}
      </Grid>
    </Screen>
  );
}
```

## `scenarios/two-players.json`

P2 flips out of turn (refused), P1 opens two cards that do not match and then asks for a card that does not exist (refused before the game sees it); the expectations check the open cards, the turn and the untouched scores.

```json
{
  "format": "playhoot.scenario.v1",
  "players": 2,
  "seed": 3,
  "duration_ms": 5000,
  "steps": [
    {
      "at_ms": 200,
      "player": "P2",
      "command": {
        "name": "flip",
        "payload": {
          "index": 0
        }
      }
    },
    {
      "at_ms": 300,
      "player": "P1",
      "command": {
        "name": "flip",
        "payload": {
          "index": 0
        }
      }
    },
    {
      "at_ms": 400,
      "player": "P1",
      "command": {
        "name": "flip",
        "payload": {
          "index": 1
        }
      }
    },
    {
      "at_ms": 500,
      "player": "P1",
      "command": {
        "name": "flip",
        "payload": {
          "index": 9
        }
      }
    }
  ],
  "observe_at_ms": [450],
  "expect": [
    {
      "at_ms": 450,
      "path": "open",
      "op": "eq",
      "value": [0, 1]
    },
    {
      "at_ms": 450,
      "path": "turn",
      "op": "eq",
      "value": 1
    },
    {
      "at_ms": 450,
      "path": "matched",
      "op": "len",
      "value": 8
    },
    {
      "path": "scores",
      "op": "eq",
      "value": {
        "P1": 0,
        "P2": 0
      }
    }
  ]
}
```
