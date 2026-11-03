# Recipe: Quiz

A timed quiz for 1 to 30 players. Each question lasts 20 seconds or until everyone answered; then the right answer and how many chose each option are shown for 5 seconds. Answers stay private until the reveal. After the last question, the final ranking stays on screen. It shows phases, private submissions, stale answers refused and scores.

## `game.project.json`

```json
{
  "format": "playhoot.project.v1",
  "aspectRatio": "16:9"
}
```

## `shared/actions.ts`

One command, `answer`. Its `phase` field is filled by the client, so an answer for an earlier question is refused as `STALE_PHASE`. The view's `phase` is the `PhaseView` the platform adds.

<!-- example: fixtures/sdk-games/quiz/shared/actions.ts -->
```ts
import { defineCommands, type PhaseView, type Standing } from '@playhoot/game-core';

// `phase` makes an answer sent for an earlier question arrive as STALE_PHASE instead of counting
// for the current one; useCommand fills it in.
export const commands = defineCommands({
  answer: { option: { type: 'number', min: 0, max: 3 }, phase: 'number' },
});

export type View = {
  question: { number: number; text: string; options: string[] } | null;
  // Shown only once the question ended.
  reveal: { correct: number; counts: number[] } | null;
  standings: Standing[];
  total: number;
  phase: PhaseView<'question' | 'reveal' | 'results', { option: number }> | null;
};
```

## `server/game.ts`

Three phases: `question` collects answers (`submit: 'answer'`), `reveal` shows the result, `results` has no deadline and is where the game ends. Scores are counted in `question`'s `end`, the only place the answers are visible. There is no command handler: the platform records the submissions.

<!-- example: fixtures/sdk-games/quiz/server/game.ts -->
```ts
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
```

## `client/Game.tsx`

The client reads the phase from the view: the seconds left (`Countdown`), who answered, and its own answer (`phase.mine`), which `Choices` shows as chosen. It never sees another player's answer before the reveal; `marks` colors the right option once revealed.

<!-- example: fixtures/sdk-games/quiz/client/Game.tsx -->
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
  const { phase, question, reveal } = view;
  const name = (player: string) => (player === id ? 'You' : player);

  if (phase.name === 'results' || question === null) {
    return (
      <Screen>
        <Text size="title">Final ranking</Text>
        <Scoreboard standings={view.standings} name={name} />
      </Screen>
    );
  }
  const points = view.standings.find((s) => s.player === id)?.points ?? 0;
  return (
    <Screen>
      <Stack direction="row" justify="between">
        <Text tone="muted">
          Question {question.number}/{view.total}
        </Text>
        <Countdown />
      </Stack>
      <Text size="xl">{question.text}</Text>
      <Choices
        label="Your answer"
        options={question.options.map((text, i) =>
          reveal ? `${text} (${reveal.counts[i]})` : text,
        )}
        value={phase.mine?.option ?? null}
        onChange={(option) => answer({ option })}
        disabled={phase.name !== 'question'}
        marks={reveal ? { [reveal.correct]: 'correct' } : undefined}
      />
      <Text tone="muted">
        {phase.name === 'question' ? `${phase.submitted.length} answered` : `Score: ${points}`}
      </Text>
    </Screen>
  );
}
```

## `scenarios/two-players.json`

P1 answers right, P2 wrong: everyone answered, so the reveal starts at once (1500 ms). P2's answer during the reveal is refused (`WRONG_PHASE`), and P1's late answer for question 1 during question 2 is refused (`STALE_PHASE`). Question 2 times out with no answers. Both answer question 3 right and the game finishes after its reveal, P1 first with 2 points.

```json
{
  "format": "playhoot.scenario.v1",
  "players": 2,
  "seed": 1,
  "duration_ms": 40000,
  "steps": [
    {
      "at_ms": 1000,
      "player": "P1",
      "command": { "name": "answer", "payload": { "option": 1, "phase": 1 } }
    },
    {
      "at_ms": 1500,
      "player": "P2",
      "command": { "name": "answer", "payload": { "option": 0, "phase": 1 } }
    },
    {
      "at_ms": 2000,
      "player": "P2",
      "command": { "name": "answer", "payload": { "option": 1, "phase": 2 } }
    },
    {
      "at_ms": 7000,
      "player": "P1",
      "command": { "name": "answer", "payload": { "option": 2, "phase": 1 } }
    },
    {
      "at_ms": 32000,
      "player": "P1",
      "command": { "name": "answer", "payload": { "option": 1, "phase": 5 } }
    },
    {
      "at_ms": 32100,
      "player": "P2",
      "command": { "name": "answer", "payload": { "option": 1, "phase": 5 } }
    }
  ],
  "observe_at_ms": [1200, 2000, 40000]
}
```
