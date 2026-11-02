# Game Creation Web v1 - Checklist

Order decided by the human on 2026-11-01. Backend items live in `../playhoot` `game-creation-v1`.

## Build (plan delivery 0)

### A. SDK base and build (with backend B)

- [x] `@playhoot/game-core` (`defineCommands`, `defineInputs`, manifest fields), `@playhoot/game-server` (`defineGame`, `reject`, the adapter to the sandbox ABI), `@playhoot/game-react` (`mountGame`, `useView`, `useCommand`, `usePlayer`). 2026-11-01.
- [x] `@playhoot/game-tools` (`npm run game -- build <project>`): both targets with rolldown (already in the workspace through Vite, instead of the plan's esbuild): `server.js` in the `sdk-v1` shape (flat, `export default` bound by a const, generated entrypoints, `__playhoot_module_values()`), `client.html` single page, `manifest.json` derived from `defineGame`, `build.json` with hashes; smoke run of start/project. 2026-11-01.
- [x] Per-file source check and type check before bundling, with file/line diagnostics. 2026-11-01.
- [x] `fixtures/sdk-games/tap-race`: one command, `update` deadline, finish, a view per player, a small React UI. Built and run through the generated entrypoints in tests. 2026-11-01.
- [x] Played in a real Session: backend B done, Tap Race seeded in the backend (`55555555-5555-4555-8555-555555555555`) and played end to end against it (two guests, 20 commands, finished with the right winner, the served frontend byte-identical to the build). 2026-11-01.

## Drafts (plan delivery 1)

- [ ] B. Authoring workspace: create a game, paste changes, file editor, resources, build, status.

## Test (plan delivery 2)

- [ ] C. SDK delivery 1: phases, deadlines, submissions, privacy, scoring, React provider and hooks, semantic controls; the quiz and "Cuánto nos conocemos".
- [ ] D. Human preview UI: synthetic participants, perspective switching.

## Publish (plan delivery 3)

- [ ] E. Game card and publishing UI.
- [ ] F. Templates and remix UI.
- [ ] G. Creation guide for agents and versioned SDK index.
