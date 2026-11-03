# Client

`client/Game.tsx` default-exports a React component (React 19). Playhoot mounts it; you never call `mountGame` yourself. The component shows one player's view and sends their commands and inputs, using `@playhoot/game-react`.

## Hooks

| Hook | Returns |
|---|---|
| `useView<V>()` | What the server's `view` returned for this player, or `null` before the first view. Re-renders on every new view. |
| `usePlayer()` | `{ id, players, locale }`: this player's id (`P1`…), every participant's id, and their Playhoot language (BCP 47, e.g. `es`). Show texts in `useLanguage()`, not in `locale`. |
| `useLanguage(languages?)` | The language this player sees the game in: one of the game's `languages` (below). |
| `useText(texts)` | `t(key, params?)` for texts made with `defineTexts` (below). |
| `useCommand(commands.name)` | A function sending that command. With no fields it takes no argument; otherwise the payload, typed from the declaration. |
| `useInputs(inputs)` | `[values, set]`: this player's current inputs (starting at their defaults) and `set(change)`, which changes some of them and sends the whole snapshot. |
| `useAsset(assets.key)` | `{ status, url }` for a declared asset (`assets.md`). |
| `useGameEvent(handler)` | Calls `handler(event)` for every `emit()` addressed to this player, once each. |
| `useGameError(handler)` | Calls `handler(error)` for every `error()` sent to this player, once each. |
| `usePhase()` | The current phase of a game with phases (`PhaseView`: name, id, round, secondsLeft, submitted, mine), or `null` (`phases.md`). |
| `usePresentation()` | How the game shows on this device: size, density, pointer, safe area, preferences (`ui.md`). |

Build the screen with the SDK's layout, controls and state components (`Screen`, `Stack`, `Grid`, `Button`, `Choices`, `TextAnswer`, `Countdown`, `Scoreboard`…): `ui.md`.

`ranking(scores, players)` is exported too, to order scores in the client.

A command that declares a `phase` field gets it filled with the current phase's id when you leave it out.

A command function resolves to the answer:

- `{ ok: true, value? }`: the handler ran; `value` is what it returned.
- `{ ok: false, code: 'invalid_payload', details }`: the payload breaks the command's declaration (a number out of range, a missing enum value…); nothing was sent. `details` lists `{ field, message }`.
- `{ ok: false, code, details? }`: the handler refused (`reject(code)`), or the command did not run (`code` `rejected` or `unavailable`).

`set` returns `{ ok: true }`, or `{ ok: false, code: 'invalid_inputs', details }` without sending. Checking locally matters: a payload or snapshot the platform refuses closes that player's connection.

## Inputs

Inputs are for what a player holds (keys, a joystick); commands are for discrete actions. Every component calling `useInputs` shares one snapshot. Send a change only when it changes (repeated equal snapshots are not sent).

<!-- example: fixtures/sdk-games/drift/client/Game.tsx -->
```tsx
  // The held arrows become one direction, sent whenever it changes.
  useEffect(() => {
    const held = new Set<string>();
    const send = () => {
      let x = 0;
      let y = 0;
      for (const key of held) {
        x += KEYS[key]?.[0] ?? 0;
        y += KEYS[key]?.[1] ?? 0;
      }
      setInputs({ move: [Math.sign(x), Math.sign(y)] });
    };
```

## Events and errors

`emit()` and `error()` reach the client once each, beside the view. Use them for moments (a sound, a toast), never for state: a player who reconnects gets the view, not past events.

<!-- example: fixtures/sdk-games/pairs/client/Game.tsx -->
```tsx
  useGameEvent<PairEvent>((event) =>
    setNotice(event.kind === 'match' ? `${event.player} found a pair!` : `${event.player} missed`),
  );
  useGameError<PairError>(() => setNotice('Wait for your turn'));
```

The view, not the answer, is the truth about the game: after a command, the next view shows its effect.

## Languages and texts

`game.project.json` lists the game's `languages`, its main one first (`project.md`). Each player sees the game in their Playhoot language when it is listed, otherwise in the main one; `useLanguage()` says which. The SDK's own texts (the `TextAnswer` button, the countdown's spoken label) come in that language too.

A game in one language simply writes its texts in it. A game in several keeps each text once per language and picks it by key: `defineTexts(languages, { ... })`, with `languages` from `'@playhoot/project'` (the build writes it from `game.project.json`). The main language's keys are the texts; every other listed language must give each of them, or the build fails with a type error. `{name}` marks a parameter.

<!-- example: fixtures/sdk-games/quiz/client/Game.tsx -->
```tsx
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
```

<!-- example: fixtures/sdk-games/quiz/client/Game.tsx -->
```tsx
  const t = useText(texts);
  const language = useLanguage(languages);
```

<!-- example: fixtures/sdk-games/quiz/client/Game.tsx -->
```tsx
        <Text tone="muted">{t('question', { number: question.number, total: view.total })}</Text>
```

Content in several languages (questions, cards, words) is plain data keyed by language. Typed with `useLanguage(languages)`, the language is one of the listed ones, so the lookup type-checks:

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

<!-- example: fixtures/sdk-games/quiz/client/Game.tsx -->
```tsx
  const { text, options } = QUESTIONS[language][question.number - 1];
```

Keep texts in the client. The server sends data the client turns into words (the question's number, an option's index, a code), never sentences: a player's language is a matter of their screen, and the same view then serves every language. Secret data stays on the server (the quiz keeps its right answers in `server/game.ts`).

## The frame

- The game is drawn at a fixed logical size given by `aspectRatio`: 1920×1080 (`16:9`), 1080×1920 (`9:16`), 1440×1080 (`4:3`), 1080×1440 (`3:4`), 1080×1080 (`1:1`). The platform scales it to the screen; `Screen` fills it and `usePresentation()` says how big it really shows (`ui.md`).
- No network: `fetch`, WebSocket and external URLs (images, fonts, scripts) do not load. Styles are inline or in the component.
- No storage: no cookies, `localStorage` or IndexedDB.
- Only what the client imports is bundled (React and the SDK included). Nothing loads at run time.
- Images, audio and video come only from declared assets (`assets.md`).
