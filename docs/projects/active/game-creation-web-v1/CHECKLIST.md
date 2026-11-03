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

- [x] B. Authoring workspace (2026-11-02): `GamesClient`, `@playhoot/feature-game-authoring`, "Crear un juego" → `/games/new` → `/games/{id}/edit` with Cambios de mi IA (paste read strictly as data, summary, apply, attempts), Archivos (edit one file), Recursos (declared assets, upload/replace/remove, preview), Construcción (status, diagnostics by line, last good build), Historial (restore). Verified end to end in headless Edge against the real backend.

- [x] F. "Compartir con mi IA" (with backend F): section `share` (active link and expiry, create / renew / revoke with confirmations, the link shown once with copy-message and copy-link, never stored nor in the URL), `GamesClient` AI-link calls. Verified end to end in headless Edge against the real backend 2026-11-02: the link fetched without auth returns the Markdown context page; renewing makes the old link 401 `ai_link_invalid`; after a reload the token appears nowhere (page or storage); revoking makes it 401.

## Test (plan delivery 2)

- [ ] C. SDK delivery 1: phases, deadlines, submissions, privacy, scoring, React provider and hooks, semantic controls; the quiz and "Cuánto nos conocemos".
- [x] D. Human preview UI (2026-11-02): "Probar juego" (`?section=preview`) on the backend's previews: players count, the real GameHost per participant (switching restarts it with the other participant's context), pause/resume, restart, end with its reason, the outdated-revision notice, start script failures and in-game `error` notices (`invalid_game_data`, `unknown_participant`); the preview lives with the workspace so changing the draft in another section keeps it. Verified end to end in headless Edge against the real backend (P1:3/P2:2 across switches, the counter frozen while paused, outdated after a new revision, ended by owner, replaced by a second tab).
- [x] H. "Escenarios" (with backend H): section `scenarios` (paste a scenario the AI wrote, run it on the current revision's build, the result summarized and copied whole for the AI; nothing kept), `GamesClient.runSimulation`. 2026-11-02; verified end to end in headless Edge against the real backend (fenced Tap Race scenario finished with winner P1, result copied as JSON, truncated paste refused locally, a failed build shows the not-ready note linking to Construcción).

## Publish (plan delivery 3)

- [x] E. Game card and publishing UI (2026-11-02): "Crear un juego" asks the name; "Ficha y publicación" (`?section=publish`) edits the card (name, description, logo, up to 8 discovery photos), publishes the current revision as public or private with each not-ready blocker linked to its section, shows the published state with a "create a Session of it" link (`/sessions/new?game=`), opens a new version; the draft sections explain the published state. `game.project.json` no longer has `name` (the card owns it). Verified end to end in headless Edge against the real backend.
- [ ] F. Templates and remix UI.
- [ ] G. Creation guide for agents and versioned SDK index.
