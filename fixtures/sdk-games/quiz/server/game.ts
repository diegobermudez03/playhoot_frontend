import { config } from '@playhoot/config/server';
import { addPoints, defineGame, ranking, type Scores } from '@playhoot/game-server';

import { commands, type View } from '../shared/actions';

// A timed quiz: every question lasts config.questionSeconds or until everyone answered, then the
// right answer is revealed for config.revealSeconds. Answers stay private until the reveal. The
// questions are configuration (config.json); which option is right is private, so only this
// server code reads it.
const QUESTIONS = config.questions;

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
      seconds: config.questionSeconds,
      submit: 'answer',
      end(state, { submissions }) {
        const { correct, options } = QUESTIONS[state.index];
        const counts = options.map(() => 0);
        for (const [player, { option }] of Object.entries(submissions)) {
          if (option >= counts.length) continue;
          counts[option] += 1;
          if (option === correct) addPoints(state.scores, player, 1);
        }
        state.reveal = { correct, counts };
        return 'reveal';
      },
    },
    reveal: {
      seconds: config.revealSeconds,
      end(state, { finish }) {
        state.reveal = null;
        state.index += 1;
        if (state.index < QUESTIONS.length) return 'question';
        finish();
        return 'results';
      },
    },
    results: {},
  },
  view: (state): Omit<View, 'phase'> => ({
    question: state.index < QUESTIONS.length ? { number: state.index + 1 } : null,
    reveal: state.reveal,
    standings: ranking(state.scores, state.players),
    total: QUESTIONS.length,
  }),
});
