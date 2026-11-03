import { addPoints, defineGame, ranking, type Scores } from '@playhoot/game-server';

import { commands, type View } from '../shared/actions';

// A timed quiz: every question lasts 20 seconds or until everyone answered, then the right answer
// is revealed for 5 seconds. Answers stay private until the reveal.
const QUESTIONS = [
  { text: 'What is 7 x 8?', options: ['54', '56', '64', '48'], correct: 1 },
  {
    text: 'Which planet is the largest?',
    options: ['Mars', 'Earth', 'Jupiter', 'Venus'],
    correct: 2,
  },
  { text: 'How many sides has a hexagon?', options: ['5', '6', '7', '8'], correct: 1 },
];

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
        const question = QUESTIONS[state.index];
        const counts = [0, 0, 0, 0];
        for (const [player, { option }] of Object.entries(submissions)) {
          counts[option] += 1;
          if (option === question.correct) addPoints(state.scores, player, 1);
        }
        state.reveal = { correct: question.correct, counts };
        return 'reveal';
      },
    },
    reveal: {
      seconds: 5,
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
  view: (state): Omit<View, 'phase'> => {
    const question = QUESTIONS[state.index];
    return {
      question: question
        ? { number: state.index + 1, text: question.text, options: question.options }
        : null,
      reveal: state.reveal,
      standings: ranking(state.scores, state.players),
      total: QUESTIONS.length,
    };
  },
});
