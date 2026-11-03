import { addPoints, defineGame, ranking, type Scores } from '@playhoot/game-server';

import { commands, type View } from '../shared/actions';

// "How well do we know each other": each round one player is the subject and answers a question
// about themselves; the others guess. Every right guess scores 1 for the guesser and 1 for the
// subject. Everyone is the subject once.
const QUESTIONS = [
  { text: 'Favorite season?', options: ['Spring', 'Summer', 'Autumn', 'Winter'] },
  { text: 'Ideal weekend?', options: ['Sleep', 'Sports', 'Friends', 'Reading'] },
  { text: 'Pick a superpower', options: ['Fly', 'Invisible', 'Teleport', 'Read minds'] },
];

type State = {
  players: string[];
  round: number;
  scores: Scores;
  reveal: { subjectChose: number; matched: string[] } | null;
};

export default defineGame({
  players: { min: 2, max: 12 },
  commands,
  setup: (players): State => ({ players, round: 0, scores: {}, reveal: null }),
  phases: {
    answer: {
      seconds: 25,
      submit: 'answer',
      end(state, { submissions }) {
        const subject = state.players[state.round];
        const chosen = submissions[subject]?.option ?? -1;
        const matched = Object.keys(submissions).filter(
          (player) => player !== subject && submissions[player].option === chosen,
        );
        for (const player of matched) {
          addPoints(state.scores, player, 1);
          addPoints(state.scores, subject, 1);
        }
        state.reveal = { subjectChose: chosen, matched };
        return 'reveal';
      },
    },
    reveal: {
      seconds: 6,
      end(state, { finish }) {
        state.reveal = null;
        state.round += 1;
        if (state.round < state.players.length) return 'answer';
        finish();
        return 'results';
      },
    },
    results: {},
  },
  view: (state): Omit<View, 'phase'> => ({
    subject: state.players[Math.min(state.round, state.players.length - 1)],
    question: QUESTIONS[state.round % QUESTIONS.length],
    reveal: state.reveal,
    standings: ranking(state.scores, state.players),
  }),
});
