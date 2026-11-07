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

- [x] `parsePastedChange` and "Cambios de mi IA" accept `edits` (find/replace) (2026-11-05): `files`, `edits` and `delete` may each be absent; a path in more than one of them is `repeated-path`; the summary adds "Editar N archivos" with each file's number of edits; the client sends `edits` only when there are some and maps `diffs` and the diagnostics' `edit`; an applied result shows each edited file's diff as the backend sent it (`applied-diffs`, marked when truncated); `edit_not_found` / `edit_ambiguous` show in the diagnostics list with the backend's message ("edit N: ..."). Logic mirror, `BACKEND_CONTRACT.md` and the package README updated.
- [x] Guide `changes.md` (2026-11-05): edits are the default for existing files, whole files only for new files or rewrites, `all` for renames; example from the Tap Race fixture (`GOAL`, `DURATION_MS`); the answers table names `diffs` and the edit diagnostics. `index.md` updated.

### N. Provenance and diff (A P1)

- [x] Historial shows each revision's provenance (2026-11-06): kind, origin, the revision a restore brings back, "copiada de la versión publicada" / "desde una plantilla" (the parent is always the revision before, so it is not shown; "Ver cambios" diffs against it). Diff view: "Ver cambios" (from the parent, 0 for revision 1) and "Comparar con la actual" open a comparison card with each file's status and the backend's diff, "Ver solo este archivo" for omitted ones; `diffRevisions` in the client, `compare` / `closeComparison` in the feature (stale answers dropped). Logic mirror and `BACKEND_CONTRACT.md` updated.

### O. Scenarios with expectations (S, T, U)

- [x] Guide `scenarios.md` rewritten (2026-11-06): holds, `expect` (ops, paths, `of`, the end), saved scenarios by path or all, the summary, `detail: full`, reading a state, refusals; example from the drift fixture. `index.md` and the recipes (each quoting its fixture scenario, tap-race added) updated.
- [x] Fixture scenarios with expectations (2026-11-06): drift (now a hold), know-me (private answers), number-guess (hidden secret), pairs, quiz and a new tap-race `first-to-goal.json`; expectations written against the real states (the backend simulation run on the built fixtures). The backend's `play/session/internal/fixturescenarios` test plays them on the built fixtures and requires every expectation to hold; `packages/game-tools/src/scenarios.test.ts` checks their shape here. The number-guess `dist/` (ignored) was stale; rebuilt.
- [x] "Escenarios" (2026-11-06): saved scenarios listed from the draft with "Ejecutar" and "Ejecutar todos"; a pasted scenario as before; the result shows passed / failed / no expectations, how many held and each failed one (of, path, op, moment, expected and actual), how it ended and the counts; a batch lists each scenario (badge or diagnostics) and opens one; "Ver un estado" reads one value of the kept result (moment, whole state or a player, path; too large and missing answered in words). Client `runSimulation` answers single or batch, `readSimulationState`; runner `runSaved`, `runAll`, `inspect`. Logic mirror and `BACKEND_CONTRACT.md` updated.

### P. Guide for agents in small pieces (H, I, N, AN)

- [x] `capabilities.md` (2026-11-06): one line per capability (what it gives, its page, an example), grouped as game logic, screen and working on a project, the SDK version (`SDK version 1.0.0.`), and what this version does not provide (decks, boards, spatial helpers, animation, a built-in asset library, timers). The backend serves it as `get_sdk_index`. Tests: it names `sdkVersion` and cites only pages that exist.
- [x] Rules labelled (2026-11-06): `index.md` defines **Required**, **Recommended** and **Escape hatch**; the rules of `project.md`, `server.md`, `client.md`, `ui.md`, `assets.md`, `building.md`, `changes.md` and `phases.md` carry them (whole sections marked "(required)" where every rule is); a test refuses any other bold label.
- [x] `policies.md` (2026-11-06): order of work (agree the game in `notes.md` → a template when the tools offer one → minimal edits, configure before rewrite → build → scenarios → assets → **Probar juego** → the owner publishes), definition of done, testing policy, asset order (HTML/CSS, SVG components kept small, the person's files, generated raster last; no built-in Playhoot assets exist yet).
- [x] `recipes/*` became `examples/*` (2026-11-06), each headed "Example" and told not to be copied as a game; references updated. Templates come from the backend catalog (R).
- [x] The guide ships with the toolchain (2026-11-06): the backend reads it from the same checkout it builds with (`GAME_TOOLCHAIN_DIR`); `@playhoot/game-core` exports `sdkVersion` (`1.0.0`) and every build records it in `build.json` (`sdk`).

### Q. Game brief (K)

- [x] `playhoot.brief.v1` in `@playhoot/game-core` (2026-11-07): `validateBrief`, `briefPhases`, `briefFormat`, `Brief`; the shared vectors (`testdata/brief-vectors.json`, identical to the backend's, checked by `packages/game-tools/src/vectors.test.ts`); `brief.json` in every fixture (phase `ready`, written from each game's rules; `scenarios.test.ts` checks them, the backend's fixture test too); the starter's empty brief lives in the backend template. Guide `brief.md` (fields, limits, phases, an example quoted from number-guess); `index.md`, `project.md`, `policies.md` and `capabilities.md` point to it.
- [x] The workspace shows the brief and its phase (2026-11-07): a phase chip in the header and, at the top of "Cambios de mi IA", "Lo acordado con tu IA" (players, goal, rounds, scoring, ending, what not everyone sees, what is still to decide), read-only; `draftBrief(files)` in the feature (absent / invalid / valid). Texts in es, en, pt-BR.

### R. Templates, step 1 (E1, E2, AI)

- [x] `GamesClient` template calls (2026-11-06): `browseTemplates`, `searchTemplates`, `inspectTemplate`, `readTemplateFiles`, `createGame(name, key, templateGameUUID?)`, `useTemplate(gameUUID, templateGameUUID, base, key)`; failure `template-not-found`.
- [x] "Crear un juego" offers a template or the starter project (2026-11-06): a `TemplatePicker` (featured first, a search, "Ver detalle" inspects one: goal, actions, files) outside the creation form; the chosen start shows above the button; with an empty catalog it says the game starts from the starter project. Historial has "Empezar de nuevo con una plantilla" (`useTemplate` as an authoring action, its result shown like a restore's). `createTemplateBrowser` in the feature. Texts in es, en, pt-BR.
- [x] Guide `templates.md` (2026-11-06): browse first, inspect few, read only needed files, say "none fits", never an example, what switching keeps; `policies.md`, `index.md` and `capabilities.md` point to it.
- [ ] `quiz` and `know-me` reworked as templates: waits for S (their content as configuration) and the backend's step 2 (published, allowed and featured through the catalog).

### S. Template configuration (F)

- [ ] `game.project.json` `config`: a schema of configurable values (number with range, boolean, enum, string, list of objects such as questions) with defaults; `config.json` holds the values; both server and client read them through a generated `@playhoot/config` module (typed); the build validates the values against the schema with diagnostics on `config.json`.
- [ ] Guide page and fixtures using it (quiz questions, rounds, durations).

### T. Build diagnostics with codes (Q)

- [ ] Every game-tools diagnostic has a stable `code`; the build's full output is written as a bounded log the backend keeps (backend T).

### V. Built-in assets (N, O; P1, after R)

- [ ] A Playhoot library of common sound effects and icons with logical keys (`ui.click`, `ui.success`, `ui.error`, `game.coin`, `game.hit`, `game.whoosh`, `game.countdown`, `card.draw`, `card.flip`) usable from a game without uploads, listed in the capability index.
