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
