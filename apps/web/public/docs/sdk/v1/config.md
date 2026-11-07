# Configuration

A game can declare values it lets change without touching code: questions, rounds, durations, words, a difficulty. A template made this way becomes another game by editing one data file. Rules are marked as in `index.md`.

## Declaring values

`game.project.json` declares each value under `"config"`: its type, what it is (`description`), its limits and, optionally, its `default`.

```json
{
  "format": "playhoot.project.v1",
  "languages": ["es", "en"],
  "config": {
    "rounds": {
      "type": "number",
      "description": "How many rounds a game has.",
      "integer": true,
      "min": 1,
      "max": 20,
      "default": 5
    },
    "title": {
      "type": "text",
      "description": "The title shown before the first round.",
      "maxLength": 60,
      "translated": true
    }
  }
}
```

`examples/quiz.md` declares a list of questions, each an object with a translated text, a list of options and a private right answer.

| `type` | Its value | Options |
|---|---|---|
| `number` | a number | `min`, `max`, `integer` (`true`: whole numbers only) |
| `boolean` | `true` or `false` | — |
| `choice` | one of `options` (1 to 50 strings) | `options` (required) |
| `text` | a text; with `translated: true`, an object with one text per language of the game | `maxLength` (default 500, at most 2000), `translated` |
| `list` | a list of `items` | `items` (required: another value), `minItems` (default 0), `maxItems` (default 100, at most 500) |
| `object` | an object with every one of `fields` | `fields` (required: values by key) |

- **Required:** keys start with a letter and hold up to 64 letters, digits or underscores; at most 50 values per object.
- **Required:** every value has a `description` of 1 to 300 characters: the person and other AIs read it to know what to change.
- **Required:** `default` is only for top-level values. A value without one must be set in `config.json`.
- Lists and objects nest at most 4 levels deep.
- `"private": true` keeps a value (or a field inside a list's objects) out of the client: only server code reads it. **Required:** mark anything players must not see, such as the right answers.

## Setting values

`config.json` holds the values, in this format. A value it does not set takes its default.

```json
{
  "format": "playhoot.config.v1",
  "values": {
    "rounds": 5,
    "title": { "es": "Noche de trivia", "en": "Trivia night" }
  }
}
```

The quiz example (`examples/quiz.md`) sets its questions here: each one's text and options in both languages, and which option is right.

The build checks every value against its declaration and reports each problem on `config.json` with its path (`questions[2].options: has 5 items; from 2 to 4`). Writing `config.json` only checks its format; a wrong value fails the build (`building.md`).

## Reading values

Two generated modules hold the values, typed from their declaration:

- `@playhoot/config`: the values without the private ones. `shared/`, `server/` and `client/` may import it.
- `@playhoot/config/server`: every value. Only `server/` may import it.

<!-- example: fixtures/sdk-games/quiz/server/game.ts -->
```ts
import { config } from '@playhoot/config/server';
```

<!-- example: fixtures/sdk-games/quiz/server/game.ts -->
```ts
      seconds: config.questionSeconds,
```

<!-- example: fixtures/sdk-games/quiz/client/Game.tsx -->
```tsx
  const { text, options } = config.questions[question.number - 1];
```

A translated text is read in the player's language: `text[language]`, with `language` from `useLanguage(languages)` (`client.md`). Values are read-only. Top-level constants may read them (`const ROUNDS = config.rounds;`), and so may `defineGame`'s settings, such as a phase's `seconds`.

## When to use it

- **Recommended:** when you build a game that could be reused (a quiz, a word game, a game of rounds), put its content and its tuning numbers in configuration from the start: questions, words, rounds, durations, points.
- **Recommended:** when you start from a template, read its configuration first (`inspect_template` returns it as `config`) and change values before code (`policies.md`).
- Keep rules in code: configuration is data, not behavior. A value the code does not read does nothing.
