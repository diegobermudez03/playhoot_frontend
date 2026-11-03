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
