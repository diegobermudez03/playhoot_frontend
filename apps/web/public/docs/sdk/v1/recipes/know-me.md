# Recipe: How well do we know each other

For 2 to 12 players. Each round one player is the subject and answers a question about themselves; everyone else guesses their answer. Every right guess gives 1 point to the guesser and 1 to the subject. Everyone is the subject once, then the ranking shows who knows whom best. It shows one submission per player per round, compared at the reveal.

## `shared/actions.ts`

<!-- example: fixtures/sdk-games/know-me/shared/actions.ts -->
```ts
import { defineCommands, type PhaseView, type Standing } from '@playhoot/game-core';

export const commands = defineCommands({
  answer: { option: { type: 'number', min: 0, max: 3 }, phase: 'number' },
});

export type View = {
  // Whose round it is: they answer about themselves, everyone else guesses.
  subject: string;
  question: { text: string; options: string[] };
  reveal: { subjectChose: number; matched: string[] } | null;
  standings: Standing[];
  phase: PhaseView<'answer' | 'reveal' | 'results', { option: number }> | null;
};
```

## `server/game.ts`

The subject and the guessers send the same command; `end` tells them apart with `state.players[state.round]`. A subject who did not answer matches nobody.

<!-- example: fixtures/sdk-games/know-me/server/game.ts -->
```ts
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
```

## `client/Game.tsx`

- `Choices` is the answer for the subject and the guess for everyone else; `marks` shows the subject's answer at the reveal.
- `Scoreboard` shows the final standings with this player highlighted.

<!-- example: fixtures/sdk-games/know-me/client/Game.tsx -->
```tsx
import {
  Choices,
  Countdown,
  Screen,
  Scoreboard,
  Stack,
  Text,
  useCommand,
  usePlayer,
  useView,
} from '@playhoot/game-react';

import { commands, type View } from '../shared/actions';

export default function Game() {
  const view = useView<View>();
  const { id } = usePlayer();
  const answer = useCommand(commands.answer);
  if (view === null || view.phase === null) return null;
  const { phase, question, reveal, subject } = view;
  const name = (player: string) => (player === id ? 'You' : player);

  if (phase.name === 'results') {
    return (
      <Screen theme={{ background: '#3b0d3f', surface: '#5b1f60' }}>
        <Text size="title">Who knows whom best</Text>
        <Scoreboard standings={view.standings} name={name} />
      </Screen>
    );
  }
  return (
    <Screen theme={{ background: '#3b0d3f', surface: '#5b1f60' }}>
      <Stack direction="row" justify="between">
        <Text tone="muted">{subject === id ? 'About you' : `About ${subject}`}</Text>
        <Countdown />
      </Stack>
      <Text size="xl">{question.text}</Text>
      <Choices
        label={subject === id ? 'Your answer' : `Your guess about ${subject}`}
        options={question.options}
        value={phase.mine?.option ?? null}
        onChange={(option) => answer({ option })}
        disabled={phase.name !== 'answer'}
        marks={reveal ? { [reveal.subjectChose]: 'correct' } : undefined}
      />
      <Text tone="muted">
        {reveal
          ? `Guessed right: ${reveal.matched.map(name).join(', ') || 'nobody'}`
          : `${phase.submitted.length} answered`}
      </Text>
    </Screen>
  );
}
```

## `scenarios/three-players.json`

Three players answer the first question; the expectations check each player sees only their own answer before the reveal, who matched the subject, the scores, and that the game ends in results.

```json
{
  "format": "playhoot.scenario.v1",
  "players": 3,
  "seed": 1,
  "duration_ms": 100000,
  "steps": [
    {
      "at_ms": 1000,
      "player": "P1",
      "command": {
        "name": "answer",
        "payload": {
          "option": 2,
          "phase": 1
        }
      }
    },
    {
      "at_ms": 1100,
      "player": "P2",
      "command": {
        "name": "answer",
        "payload": {
          "option": 2,
          "phase": 1
        }
      }
    },
    {
      "at_ms": 1200,
      "player": "P3",
      "command": {
        "name": "answer",
        "payload": {
          "option": 0,
          "phase": 1
        }
      }
    }
  ],
  "observe_at_ms": [1150, 1300, 100000],
  "expect": [
    {
      "at_ms": 1150,
      "of": "P1",
      "path": "phase.mine.option",
      "op": "eq",
      "value": 2
    },
    {
      "at_ms": 1150,
      "of": "P3",
      "path": "phase.mine",
      "op": "eq",
      "value": null
    },
    {
      "at_ms": 1150,
      "of": "P3",
      "path": "phase.submitted",
      "op": "eq",
      "value": ["P1", "P2"]
    },
    {
      "at_ms": 1300,
      "path": "game.reveal.matched",
      "op": "eq",
      "value": ["P2"]
    },
    {
      "at_ms": 1300,
      "path": "game.scores",
      "op": "eq",
      "value": {
        "P1": 1,
        "P2": 1
      }
    },
    {
      "path": "phases.current.name",
      "op": "eq",
      "value": "results"
    }
  ]
}
```
