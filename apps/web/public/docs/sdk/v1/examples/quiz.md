# Example: Quiz

An example to learn the SDK from, every file explained. Do not copy it as the start of a game: start from a template (`policies.md`), or from the starter project.

A timed quiz for 1 to 30 players. Each question lasts 20 seconds (configurable) or until everyone answered; then the right answer and how many chose each option are shown for 5 seconds. Answers stay private until the reveal. After the last question, the final ranking stays on screen. It shows configuration (its questions and durations are data a template user changes), phases, private submissions, stale answers refused and scores, and a game written in two languages (Spanish first, English): each player sees it in their Playhoot language when it is one of them, in Spanish otherwise.

## `game.project.json`

Besides the languages, it declares what the quiz lets change without touching code (`config.md`): the questions (each one's text and options in every language, and which option is right, `private` so only the server reads it) and how long a question and its reveal last, with their limits.

<!-- example: fixtures/sdk-games/quiz/game.project.json -->
```json
{
  "format": "playhoot.project.v1",
  "languages": ["es", "en"],
  "aspectRatio": "16:9",
  "config": {
    "questions": {
      "type": "list",
      "description": "The questions, asked in this order.",
      "minItems": 1,
      "maxItems": 50,
      "items": {
        "type": "object",
        "description": "One question.",
        "fields": {
          "text": {
            "type": "text",
            "description": "What is asked.",
            "maxLength": 200,
            "translated": true
          },
          "options": {
            "type": "list",
            "description": "The options players choose from.",
            "minItems": 2,
            "maxItems": 4,
            "items": {
              "type": "text",
              "description": "One option.",
              "maxLength": 60,
              "translated": true
            }
          },
          "correct": {
            "type": "number",
            "description": "Which option is right, counting from 0.",
            "integer": true,
            "min": 0,
            "max": 3,
            "private": true
          }
        }
      }
    },
    "questionSeconds": {
      "type": "number",
      "description": "How long each question stays open, in seconds.",
      "integer": true,
      "min": 5,
      "max": 120,
      "default": 20
    },
    "revealSeconds": {
      "type": "number",
      "description": "How long the right answer shows, in seconds.",
      "integer": true,
      "min": 2,
      "max": 30,
      "default": 5
    }
  }
}
```

## `config.json`

The values: the three questions. The durations are not set, so their defaults apply. Making another quiz from this one means changing this file, not the code.

<!-- example: fixtures/sdk-games/quiz/config.json -->
```json
{
  "format": "playhoot.config.v1",
  "values": {
    "questions": [
      {
        "text": { "es": "¿Cuánto es 7 x 8?", "en": "What is 7 x 8?" },
        "options": [
          { "es": "54", "en": "54" },
          { "es": "56", "en": "56" },
          { "es": "64", "en": "64" },
          { "es": "48", "en": "48" }
        ],
        "correct": 1
      },
      {
        "text": { "es": "¿Qué planeta es el más grande?", "en": "Which planet is the largest?" },
        "options": [
          { "es": "Marte", "en": "Mars" },
          { "es": "Tierra", "en": "Earth" },
          { "es": "Júpiter", "en": "Jupiter" },
          { "es": "Venus", "en": "Venus" }
        ],
        "correct": 2
      },
      {
        "text": {
          "es": "¿Cuántos lados tiene un hexágono?",
          "en": "How many sides has a hexagon?"
        },
        "options": [
          { "es": "5", "en": "5" },
          { "es": "6", "en": "6" },
          { "es": "7", "en": "7" },
          { "es": "8", "en": "8" }
        ],
        "correct": 1
      }
    ]
  }
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
  // Which question is asked (1-based); its text and options are configuration (`@playhoot/config`).
  question: { number: number } | null;
  // Shown only once the question ended.
  reveal: { correct: number; counts: number[] } | null;
  standings: Standing[];
  total: number;
  phase: PhaseView<'question' | 'reveal' | 'results', { option: number }> | null;
};
```

## `server/game.ts`

Three phases: `question` collects answers (`submit: 'answer'`), `reveal` shows the result, `results` has no deadline and is where the game ends. The questions and durations come from `@playhoot/config/server`, the only module with the private `correct`. Scores are counted in `question`'s `end`, the only place the answers are visible. There is no command handler: the platform records the submissions.

<!-- example: fixtures/sdk-games/quiz/server/game.ts -->
```ts
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
```

## `client/Game.tsx`

The client reads each question's text and options from `@playhoot/config` (without `correct`) in the player's language, and the phase from the view: the seconds left (`Countdown`), who answered, and its own answer (`phase.mine`), which `Choices` shows as chosen. It never sees another player's answer before the reveal; `marks` colors the right option once revealed.

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
import { config } from '@playhoot/config';
import { languages } from '@playhoot/project';

import { commands, type View } from '../shared/actions';

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
  // The question's public part: its text and options (which one is right stays on the server).
  const { text, options } = config.questions[question.number - 1];
  const points = view.standings.find((s) => s.player === id)?.points ?? 0;
  return (
    <Screen>
      <Stack direction="row" justify="between">
        <Text tone="muted">{t('question', { number: question.number, total: view.total })}</Text>
        <Countdown />
      </Stack>
      <Text size="xl">{text[language]}</Text>
      <Choices
        label={t('yourAnswer')}
        options={options.map((option, i) =>
          reveal ? `${option[language]} (${reveal.counts[i]})` : option[language],
        )}
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
