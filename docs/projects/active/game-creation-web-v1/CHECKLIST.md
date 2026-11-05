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

- [x] C0. SDK client gaps found by the guide (2026-11-02): typed assets + `useAsset`, `useInputs`, `useGameEvent` / `useGameError`, payload validation before sending (shared vectors with the backend); fixtures `pairs` and `drift` built and simulated against the real backend; guide updated.
- [x] C. SDK delivery 1: phases, deadlines, submissions, privacy, scoring, React provider and hooks, semantic controls; the quiz and "Cuánto nos conocemos". Client side done 2026-11-02: layout, semantic controls (activate, select, text; React Aria 3.53.1 + react-stately 3.51.0), game-state components, the presentation context (bridge v2), input requirements read by the build and recorded at publication, the six reference clients rewritten, guide `ui.md`; the host screen keeps a finished game's final view. Hold/drag/move2D/aim2D are later deliveries. Languages (2026-11-02, decided by the human): `game.project.json` `languages` (required, main first, Playhoot's languages); the game shows each player their Playhoot language when declared, else the main one, resolved in the frame from the build's `@playhoot/project`; `defineTexts` / `useText` / `useLanguage`; the SDK's own texts in es, en, pt-BR; the build records the languages, publishing copies them to the version and release, the card shows them; the quiz is bilingual (es, en). The preview's compact layout shows the game first at full width with a control bar below.
  - [x] Server modules (2026-11-02): declarative `phases` in `defineGame` (deadlines run by the platform, a window includes its start and excludes its deadline, due phases end before the operation, `submit` commands collected privately, `untilAllSubmit`, `lock`, `accepts`/`WRONG_PHASE`, a `phase` field refusing late commands as `STALE_PHASE`, `endPhase()`), `phase` added to views (`PhaseView`, whole `secondsLeft`), `addPoints`/`ranking` with ties, `usePhase`, a finished game keeping its final view until the player leaves; fixtures `quiz` and `know-me` with scenarios; guide `phases.md` and two recipes. Verified against a real backend (built under `sdk-v1`, scenarios simulated).
  - [ ] Semantic controls, layout components and the presentation context.
- [x] D. Human preview UI (2026-11-02): "Probar juego" (`?section=preview`) on the backend's previews: players count, the real GameHost per participant (switching restarts it with the other participant's context), pause/resume, restart, end with its reason, the outdated-revision notice, start script failures and in-game `error` notices (`invalid_game_data`, `unknown_participant`); the preview lives with the workspace so changing the draft in another section keeps it. Verified end to end in headless Edge against the real backend (P1:3/P2:2 across switches, the counter frozen while paused, outdated after a new revision, ended by owner, replaced by a second tab).
- [x] H. "Escenarios" (with backend H): section `scenarios` (paste a scenario the AI wrote, run it on the current revision's build, the result summarized and copied whole for the AI; nothing kept), `GamesClient.runSimulation`. 2026-11-02; verified end to end in headless Edge against the real backend (fenced Tap Race scenario finished with winner P1, result copied as JSON, truncated paste refused locally, a failed build shows the not-ready note linking to Construcción).

## Publish (plan delivery 3)

- [x] E. Game card and publishing UI (2026-11-02): "Crear un juego" asks the name; "Ficha y publicación" (`?section=publish`) edits the card (name, description, logo, up to 8 discovery photos), publishes the current revision as public or private with each not-ready blocker linked to its section, shows the published state with a "create a Session of it" link (`/sessions/new?game=`), opens a new version; the draft sections explain the published state. `game.project.json` no longer has `name` (the card owns it). Verified end to end in headless Edge against the real backend.
- [~] F. Templates and remix UI as the plan defined them: superseded 2026-11-05 by R below (templates are published games their owners mark; the AI discovers them).
- [x] I. AI apps through MCP (2026-11-03): "Mis juegos" (`/games`), the OAuth consent page (`/connect-ai?request=`), "IAs conectadas" (`/account/ai-connections`), `GamesClient.listGames` and `AiAccessClient`, all with unit tests. Verified end to end in headless Edge against the backend's MCP with a real OAuth client (consent → Permitir → loopback callback → token → `list_my_games`/`create_game`; the game in Mis juegos opening its workspace; Desconectar → the next MCP call 401; No permitir → `error=access_denied`; a used request shows the restart message).
- [x] G. Creation guide for agents, v1 (2026-11-02): English Markdown for AI readers at `apps/web/public/docs/sdk/v1/` (served as-is at `/docs/sdk/v1/*.md`): index, project, server, client, assets, changes, building, scenarios, recipes Tap Race and Number Guess. Documents only what exists; grows with each SDK module. Every TypeScript example is quoted from a fixture project the tools build (`fixtures/sdk-games/tap-race`, `number-guess`), checked by `packages/game-tools/src/guide.test.ts`; JSON examples must parse; the index must list every page. The backend context page links it (`PUBLIC_WEB_BASE_URL`).

## Realignment (checklist `../docs/08_Playhoot_Checklist_Flujo_de_Creacion.md`, decided 2026-11-05)

Letters match the backend's `game-creation-v1` CHECKLIST, which holds each item's backend half and the decisions. `npm run check` and the logic mirror (`docs/logic/`) apply to every item.

### L. Read surface in the workspace (B)

- [x] Historial newest first and paged (2026-11-05): `listRevisions(gameUUID, before?)`, `loadOlderRevisions` appending the next page ("Ver revisiones anteriores", dropped if the first page was read again meanwhile), `olderRevisions` in the state; logic mirror and `BACKEND_CONTRACT.md` updated. The attempts paging was moved out with the backend's.

### M. Patches (C)

- [ ] `parsePastedChange` and "Cambios de mi IA" accept `edits` (find/replace): the summary shows each edited file and its edits, the applied diff from the answer, and `edit_not_found` / `edit_ambiguous` diagnostics.
- [ ] Guide `changes.md`: edits are the default for existing files; whole files only for new files or rewrites; example from a fixture.

### N. Provenance and diff (A P1)

- [ ] Historial shows each revision's origin, parent, restored-from and template, and a diff view between two revisions (backend diff endpoint).

### O. Scenarios with expectations (S, T, U)

- [ ] Guide `scenarios.md`: `expect`, hold segments, saved scenarios run by path or all, compact result and reading state on demand.
- [ ] Every fixture keeps scenarios with expectations under `scenarios/`, and a test runs them through the backend simulation contract (or a local check of their shape when the backend is not available).
- [ ] "Escenarios" section: run a pasted scenario, one saved scenario or all; show passed/failed expectations with expected and actual; inspect one state on demand.

### P. Guide for agents in small pieces (H, I, N, AN)

- [ ] `capabilities.md`: the compact capability index (each capability one line: what it gives, its page, its example) with the SDK version; the backend serves it as `get_sdk_index`.
- [ ] Every rule in the guide labelled as required, recommended or escape hatch.
- [ ] `policies.md`: creation sequence (brief → templates → minimal changes → build → scenarios → assets → preview → the owner publishes), definition of done, testing policy, configure before rewrite, asset policy (HTML/CSS, then SVG as components, then Playhoot built-in assets, then the user's files, raster last; guidance against huge generated SVG).
- [ ] The current `recipes/*` become `examples/*` (to learn the SDK, never cloned as a game); templates come from the backend catalog (R).
- [ ] The guide ships with the toolchain package so the backend serves the version it builds with (backend P); the SDK gets a version string recorded in `build.json`.

### Q. Game brief (K)

- [ ] `playhoot.brief.v1` schema in `@playhoot/game-core` with the shared validation vectors; `brief.json` in every fixture and in the starter; guide `brief.md`.
- [ ] The workspace shows the brief and its phase (read-only summary; edited as a file or through the AI).

### R. Templates, step 1 (E1, E2, AI)

- [ ] `GamesClient` template calls (browse, search, inspect, read file, create from template, use on a draft).
- [ ] "Crear un juego" offers starting from a template (featured, categories, search; inspect before choosing) or from the minimal project; "Usar una plantilla" on a draft applies one as a new revision. Works with an empty catalog (shows only the minimal start).
- [ ] Guide `templates.md`: browse first, inspect few candidates, read only needed files, decide "none fits", what is kept when switching templates.
- [ ] `quiz` and `know-me` reworked as templates: generic, content in configuration (S), strong scenarios; seeded in the backend as published, allowed and featured, for acceptance case 2.

### S. Template configuration (F)

- [ ] `game.project.json` `config`: a schema of configurable values (number with range, boolean, enum, string, list of objects such as questions) with defaults; `config.json` holds the values; both server and client read them through a generated `@playhoot/config` module (typed); the build validates the values against the schema with diagnostics on `config.json`.
- [ ] Guide page and fixtures using it (quiz questions, rounds, durations).

### T. Build diagnostics with codes (Q)

- [ ] Every game-tools diagnostic has a stable `code`; the build's full output is written as a bounded log the backend keeps (backend T).

### V. Built-in assets (N, O; P1, after R)

- [ ] A Playhoot library of common sound effects and icons with logical keys (`ui.click`, `ui.success`, `ui.error`, `game.coin`, `game.hit`, `game.whoosh`, `game.countdown`, `card.draw`, `card.flip`) usable from a game without uploads, listed in the capability index.
