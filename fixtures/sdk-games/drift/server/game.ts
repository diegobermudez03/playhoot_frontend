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
