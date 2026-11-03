import { addPoints, defineGame, ranking, type Scores } from '@playhoot/game-server';

import { commands, type View } from '../shared/actions';

// A timed quiz: every question lasts 20 seconds or until everyone answered, then the right answer
// is revealed for 5 seconds. Answers stay private until the reveal. The question texts are in
// shared/questions.ts (the client shows them); the right option of each question only here.
const CORRECT = [1, 2, 1];

type State = {
  players: string[];
  index: number;
  scores: Scores;
  reveal: { correct: number; counts: number[] } | null;
};

export default defineGame({
  players: { min: 1, max: 30 },
  commands,
  setup: (players): State => ({ players, index: 0, scores: {}, reveal: null }),
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
  },
  view: (state): Omit<View, 'phase'> => ({
    question: state.index < CORRECT.length ? { number: state.index + 1 } : null,
    reveal: state.reveal,
    standings: ranking(state.scores, state.players),
    total: CORRECT.length,
  }),
});
