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
- [ ] D. Human preview UI: synthetic participants, perspective switching.
- [x] H. "Escenarios" (with backend H): section `scenarios` (paste a scenario the AI wrote, run it on the current revision's build, the result summarized and copied whole for the AI; nothing kept), `GamesClient.runSimulation`. 2026-11-02; verified end to end in headless Edge against the real backend (fenced Tap Race scenario finished with winner P1, result copied as JSON, truncated paste refused locally, a failed build shows the not-ready note linking to Construcción).

## Publish (plan delivery 3)

- [ ] E. Game card and publishing UI.
- [ ] F. Templates and remix UI.
- [ ] G. Creation guide for agents and versioned SDK index.
