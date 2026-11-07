# Capabilities

SDK version 1.0.0. One line per capability: what it gives, where it is explained, and an example that uses it. Read only the pages your game needs.

## Game logic (server)

| Capability | What it gives | Page | Example |
|---|---|---|---|
| Game definition | `defineGame`: players range, initial state, one view per player | `server.md` | `examples/tap-race.md` |
| Commands | Discrete actions with typed, validated payloads and answers (`reject`) | `server.md` | `examples/number-guess.md` |
| Continuous inputs | Held keys or sticks sent as snapshots (`defineInputs`, `input`) | `server.md`, `client.md` | `examples/drift.md` |
| Time and deadlines | Session time, `update` about every 100 ms, deadlines kept in the state | `server.md` | `examples/tap-race.md` |
| Randomness | `Math.random()` seeded per Session, repeatable in scenarios | `server.md` | `examples/pairs.md` |
| Private information | Each player's view shows only what they may know | `server.md` | `examples/number-guess.md` |
| Events and errors | One-off messages to some players (`emit`, `error`) | `server.md`, `client.md` | `examples/pairs.md` |
| Leaving and rejoining | `leave`, `rejoin` | `server.md` | `examples/number-guess.md` |
| Phases | Timed steps run by the platform, with private submissions and stale answers refused | `phases.md` | `examples/quiz.md` |
| Scores and ranking | `addPoints`, `ranking` (ties share a rank) | `phases.md` | `examples/quiz.md` |
| Ending | `finish()`; the last view stays on screen | `server.md` | `examples/tap-race.md` |

## Screen (client)

| Capability | What it gives | Page | Example |
|---|---|---|---|
| Hooks | The player's view, id, language, commands, inputs, phase, events | `client.md` | `examples/quiz.md` |
| Layout | `Screen`, `Stack`, `Grid`, `Panel`, `Text`, `u()` sizes | `ui.md` | `examples/quiz.md` |
| Controls | `Button`, `Choices`, `TextAnswer`: touch, mouse, keyboard and screen readers | `ui.md` | `examples/quiz.md` |
| Game state display | `Countdown`, `Scoreboard`, `AssetImage` | `ui.md` | `examples/quiz.md` |
| Presentation | Device size, density, pointer, safe area, reduced motion, high contrast | `ui.md` | — |
| Languages and texts | `es`, `en`, `pt-BR`; `defineTexts`, `useText`, content per language | `client.md` | `examples/quiz.md` |
| Assets | Declared images, audio and video, uploaded apart, with fallbacks | `assets.md` | `examples/pairs.md` |

## Working on a project

| Capability | What it gives | Page |
|---|---|---|
| Project | Files, `game.project.json`, imports, limits | `project.md` |
| Changes | Find/replace edits, whole files, deletes, conflicts, restore | `changes.md` |
| Builds | Stages and diagnostics | `building.md` |
| Scenarios | Scripted players, holds, expectations checked by the platform, saved scenarios, states on demand | `scenarios.md` |
| Policies | The order of work, what done means, testing and assets | `policies.md` |
| Brief | The agreed game and the phase of the work, in `brief.json` | `brief.md` |

## Not in this version

The SDK does not provide these: write them in the game's own code, kept small and in `shared/` or `server/` helpers.

- Card decks, boards and grids of cells, teams, inventories.
- Spatial helpers: collisions, physics, cameras, tile maps (`examples/drift.md` moves points by hand).
- Animation helpers beyond CSS transitions, and a built-in library of icons, images or sounds.
- Timers: keep deadlines in the state and check them in `update`.
