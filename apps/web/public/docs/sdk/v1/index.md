# Playhoot SDK guide, version 1

Start here. This guide is written for an AI agent building a game with a person on Playhoot. It describes only what exists in this version.

## What a Playhoot game is

A multiplayer game in two parts, written in TypeScript in one project:

- **Server logic** (`server/`): the only authority. It holds the game state, decides every rule and tells each player what they may see. It runs in a sandbox on Playhoot's servers.
- **Client** (`client/`): a React component that shows one player's view and sends their actions. It runs in an isolated frame in the player's browser, with no network and no storage.

Shared declarations (the commands players may send, the view's type) live in `shared/`. Playhoot builds both parts from the sources; you never write build configuration.

## How to work with Playhoot

The person gives you a link to their game. Reading it shows the current revision, its build result, assets, recent attempts, `notes.md` and the sources.

1. Read the link. Note the revision you read.
2. Produce a change: a JSON document with the files you change (`changes.md`).
   - If you cannot send HTTP requests, give it to the person. They paste it in the section **Cambios de mi IA** (section id `ai`) and tell you when it is applied.
   - If you can, POST it to the link's `/changes` URL.
3. Every new revision is built automatically. Read the link again (or wait on its `/build` URL) to see the result and fix diagnostics (`building.md`).
4. Check behavior with a scenario (`scenarios.md`): POST it to the link's `/simulations` URL, or give it to the person, who pastes it in **Escenarios** (id `scenarios`) and sends you the result.
5. The person plays it in **Probar juego** (id `preview`), switching between players.
6. Images, audio and video are declared in `game.project.json`; the person uploads them in **Recursos** (id `assets`), or you PUT them (`assets.md`).
7. Only the owner publishes, in **Ficha y publicación** (id `publish`). You cannot publish.

Never claim something happened (applied, built, uploaded, passed) without reading the link again or getting the answer of the request.

Keep `notes.md` current: purpose, rules agreed with the person, open decisions, known problems. Whoever continues the game starts there.

## Pages

- `project.md`: files, folders, `game.project.json`, import rules, limits.
- `server.md`: `defineGame`, commands, handlers, timing, sandbox rules.
- `client.md`: the React hooks, languages and texts, and what the frame allows.
- `ui.md`: layout, controls (activate, select, text), game-state components, presentation, and which devices a game plays on.
- `assets.md`: declaring and uploading images, audio and video.
- `changes.md`: the change document, conflicts, idempotency, restore.
- `building.md`: build stages and diagnostics.
- `scenarios.md`: scenario and result formats.
- `phases.md`: timed phases, private submissions, scores and the end of the game.
- `recipes/tap-race.md`: the starter game, every file explained.
- `recipes/number-guess.md`: a turn-based game with private information, every file explained.
- `recipes/pairs.md`: a memory game with an optional image, events and errors.
- `recipes/drift.md`: a movement game driven by held inputs and `update`.
- `recipes/quiz.md`: a timed quiz with private answers, a reveal and a final ranking, in two languages.
- `recipes/know-me.md`: players guess one another's answers, round by round.

All pages are under the same address as this one.
