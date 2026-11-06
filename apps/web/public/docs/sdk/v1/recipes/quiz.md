# Recipe: Quiz

A timed quiz for 1 to 30 players. Each question lasts 20 seconds or until everyone answered; then the right answer and how many chose each option are shown for 5 seconds. Answers stay private until the reveal. After the last question, the final ranking stays on screen. It shows phases, private submissions, stale answers refused and scores, and a game written in two languages (Spanish first, English): each player sees it in their Playhoot language when it is one of them, in Spanish otherwise.

## `game.project.json`

<!-- example: fixtures/sdk-games/quiz/game.project.json -->
```json
{
  "format": "playhoot.project.v1",
  "languages": [
    "es",
    "en"
  ],
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
  // Which question is asked (1-based); its text is in shared/questions.ts, in the player's language.
  question: { number: number } | null;
  // Shown only once the question ended.
  reveal: { correct: number; counts: number[] } | null;
  standings: Standing[];
  total: number;
  phase: PhaseView<'question' | 'reveal' | 'results', { option: number }> | null;
};
```

## `shared/questions.ts`

The questions as players read them, once per language. Public: the client shows them. Only the server knows which option is right.

<!-- example: fixtures/sdk-games/quiz/shared/questions.ts -->
```ts
// The questions players read, in each language the game is written in. Public: the client shows
// them, so the right answers live only in server/game.ts.
export const QUESTIONS = {
  es: [
    { text: '¿Cuánto es 7 x 8?', options: ['54', '56', '64', '48'] },
    { text: '¿Qué planeta es el más grande?', options: ['Marte', 'Tierra', 'Júpiter', 'Venus'] },
    { text: '¿Cuántos lados tiene un hexágono?', options: ['5', '6', '7', '8'] },
  ],
  en: [
    { text: 'What is 7 x 8?', options: ['54', '56', '64', '48'] },
    { text: 'Which planet is the largest?', options: ['Mars', 'Earth', 'Jupiter', 'Venus'] },
    { text: 'How many sides has a hexagon?', options: ['5', '6', '7', '8'] },
  ],
};
```

## `server/game.ts`

Three phases: `question` collects answers (`submit: 'answer'`), `reveal` shows the result, `results` has no deadline and is where the game ends. Scores are counted in `question`'s `end`, the only place the answers are visible. There is no command handler: the platform records the submissions.

<!-- example: fixtures/sdk-games/quiz/server/game.ts -->
```ts
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
```

## `client/Game.tsx`

The client reads the phase from the view: the seconds left (`Countdown`), who answered, and its own answer (`phase.mine`), which `Choices` shows as chosen. It never sees another player's answer before the reveal; `marks` colors the right option once revealed.

<!-- example: fixtures/sdk-games/quiz/client/Game.tsx -->
```tsx
import {
  Choices,
  Countdown,
  defineTexts,
  Screen,
  Scoreboard,
  Stack,
  Text,
  useCommand,
  useLanguage,
  usePlayer,
  useText,
  useView,
} from '@playhoot/game-react';
import { languages } from '@playhoot/project';

import { commands, type View } from '../shared/actions';
import { QUESTIONS } from '../shared/questions';

const texts = defineTexts(languages, {
  es: {
    question: 'Pregunta {number}/{total}',
    yourAnswer: 'Tu respuesta',
    answered: '{count} respondieron',
    score: 'Puntaje: {points}',
    ranking: 'Ranking final',
    you: 'Tú',
  },
  en: {
    question: 'Question {number}/{total}',
    yourAnswer: 'Your answer',
    answered: '{count} answered',
    score: 'Score: {points}',
    ranking: 'Final ranking',
    you: 'You',
  },
});

export default function Game() {
  const view = useView<View>();
  const { id } = usePlayer();
  const t = useText(texts);
  const language = useLanguage(languages);
  const answer = useCommand(commands.answer);
  if (view === null || view.phase === null) return null;
  const { phase, question, reveal } = view;
  const name = (player: string) => (player === id ? t('you') : player);

  if (phase.name === 'results' || question === null) {
    return (
      <Screen>
        <Text size="title">{t('ranking')}</Text>
        <Scoreboard standings={view.standings} name={name} />
      </Screen>
    );
  }
  const { text, options } = QUESTIONS[language][question.number - 1];
  const points = view.standings.find((s) => s.player === id)?.points ?? 0;
  return (
    <Screen>
      <Stack direction="row" justify="between">
        <Text tone="muted">{t('question', { number: question.number, total: view.total })}</Text>
        <Countdown />
      </Stack>
      <Text size="xl">{text}</Text>
      <Choices
        label={t('yourAnswer')}
        options={options.map((option, i) => (reveal ? `${option} (${reveal.counts[i]})` : option))}
        value={phase.mine?.option ?? null}
        onChange={(option) => answer({ option })}
        disabled={phase.name !== 'question'}
        marks={reveal ? { [reveal.correct]: 'correct' } : undefined}
      />
      <Text tone="muted">
        {phase.name === 'question'
          ? t('answered', { count: phase.submitted.length })
          : t('score', { points })}
      </Text>
    </Screen>
  );
}
```

## `scenarios/two-players.json`

Both players answer; the expectations check the submission, the reveal of the first question, the scores during and after the game, and that it ends in results.

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
      "command": {
        "name": "answer",
        "payload": {
          "option": 1,
          "phase": 1
        }
      }
    },
    {
      "at_ms": 1500,
      "player": "P2",
      "command": {
        "name": "answer",
        "payload": {
          "option": 0,
          "phase": 1
        }
      }
    },
    {
      "at_ms": 2000,
      "player": "P2",
      "command": {
        "name": "answer",
        "payload": {
          "option": 1,
          "phase": 2
        }
      }
    },
    {
      "at_ms": 7000,
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
      "at_ms": 32000,
      "player": "P1",
      "command": {
        "name": "answer",
        "payload": {
          "option": 1,
          "phase": 5
        }
      }
    },
    {
      "at_ms": 32100,
      "player": "P2",
      "command": {
        "name": "answer",
        "payload": {
          "option": 1,
          "phase": 5
        }
      }
    }
  ],
  "observe_at_ms": [1200, 2000, 40000],
  "expect": [
    {
      "at_ms": 1200,
      "path": "phases.submissions.P1.option",
      "op": "eq",
      "value": 1
    },
    {
      "at_ms": 2000,
      "path": "game.reveal.correct",
      "op": "eq",
      "value": 1
    },
    {
      "at_ms": 2000,
      "path": "game.scores",
      "op": "eq",
      "value": {
        "P1": 1
      }
    },
    {
      "path": "game.scores",
      "op": "eq",
      "value": {
        "P1": 2,
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
