Process: Project execution (session-play-v1), human-directed implementation
Topic: First web vertical slice (join link -> join -> play) per docs/Playhoot_Frontend_Architecture_Plan.docx
Current stage: display names + players list with presence (backend + frontend) implemented and verified end to end 2026-10-20; before that plan step 6 (Session Play, completion gate J met); same day: steps 4+5 (GameHost, SDK, bridge v1 ADR-0005 ACCEPTED, Space Drift fixture, lab), step 3, design system, i18n, Join Session, backend Z2, foundation
Current execution surface: CODEBASE AGENT
Related durable artifacts: docs/projects/active/session-play-v1/PROJECT.md, docs/projects/active/session-play-v1/CHECKLIST.md, docs/Playhoot_Frontend_Architecture_Plan.docx, ARCHITECTURE.md, docs/architecture/BACKEND_CONTRACT.md, docs/decisions/architecture/ADR-0001-workspace-tooling-for-the-frontend-foundation.md
Blocked by: nothing (open human decisions in PROJECT.md; a real WS upgrade check waits for the human's local DB to match the backend schema)
Next action: wait for the human; by the plan step 7 (fixed-aspect viewport; needs Z5 aspect ratio from the backend), 8 (adaptive presentation), 9 (hardening), K (observability). Uncommitted backend changes in ../playhoot (display names, roster_update, migration 20261021000000, docs) for the human to review/commit; the human committed the earlier Space Drift seed and added a Parqués game (backend seed + fixtures/games/parques, uncommitted here) on their own; frontend URL re-signing per attaching connection (Z3) implemented in the backend 2026-10-20, uncommitted there
Last durable checkpoint: Session Play; CHECKLIST B/C/D/E/F/J/K/M/Z, CURRENT_STATE, package READMEs, docs/logic (state_sessionplay.go, view_session_started.go, FLOWS 5-7, 11-12), PROJECT; backend: seed migration seed_20261020000000_space_drift_frontend + seeddata/, play/CURRENT_STATE.md, ENGINEERING_RADAR (bucket CORS), session-runtime-v1 PROJECT (2026-10-20)
Last updated: 2026-10-20

## Working agreement (copied from the backend's practice; confirm with the human, PROJECT.md decision 1)

- The human directs what to implement and in what order. Do not plan a task order on your own.
- The agent debates, proposes, and flags where an instruction is under-specified or does not satisfy the plan; the human decides.
- The plan is the skeleton; concrete implementation is decided together, step by step.
- CHECKLIST.md is the end-state verification list. Tick only when implemented AND verified. Surface skipped items.
- Backend changes go through the backend repository's own workflow, only when the human directs them (orchestrator "Cross-Repository Concerns").

## Context notes

- The plan is a .docx: unzip, read `word/document.xml`, strip tags; tables (`w:tbl`) contain the diagrams and decision tables.
- Backend contract inspected at backend `36d0c9d`; the most consequential gaps are G4 (no session UUID for code-joined players, code released at start) and G5/G6 (single signed HTML artifact, no assets, no aspect ratio, no bridge). Tracked as CHECKLIST Z.
- The backend's own project explicitly left the frontend SDK and generated-game host out of its scope, so the bridge protocol is ours to define.
- Local Node is 22.14: React Router 8 needs >= 22.22, so React Router 7 was used (ADR-0001). TypeScript pinned to 6.0 because typescript-eslint supports < 6.1.
- pnpm is not installed; npm workspaces are used.
- Markdown is excluded from Prettier so documentation is not reformatted.
- 2026-10-20, local environment: the human's local Postgres lacks `play_sessions.expires_at` (and other later columns) that the backend now writes, so `POST /v1/sessions` fails with 500 locally (likely an edited, already-applied migration, or a DB to reset). Not touched; reported to the human. Two stale RUNNING sessions exist in that DB; do not attach to them (recovery would write).
- The backend runs with `go run .` from `../playhoot` (docker compose services were already up). On Windows, stopping a backgrounded `npm run dev` leaves the vite node process alive; stop it by PID.
- Design iteration mode (human, 2026-10-20): the human says they are bad at design; the agent proposes its own version and the human reacts. Keep `/design` (apps/web/src/dev/DesignRoute.tsx) showing every screen state so feedback can be given without a backend.
- Visual checks: Edge headless can screenshot, but `--window-size` has a ~500 px minimum width; use the DevTools protocol with `Emulation.setDeviceMetricsOverride` for phone widths (a scratchpad script did this; not in the repo).
- End-to-end runs against the backend need a database matching the backend schema. The human's `playhoot` DB was behind on 2026-10-20; the run used a temporary `playhoot_fe_e2e` database (created, then dropped) via `DATABASE_NAME=... go run .`, which `.env` does not override.
- i18n (human rule 2026-10-20): every UI text in the catalogs, whole ICU sentences; add new messages to `en.ts`, `es.ts`, `pt-BR.ts` in the same change (parity test). The human does not know FE/i18n; explain choices briefly.
- Human preferences (2026-10-20): loves the design; wants everything driven by global variables, lively motion (fun, not excessive) and sound effects; agents build assuming assets exist and list them in docs/design/ASSETS.md for the human to source (AI-generable or downloadable).
- Running TypeScript ad hoc against the backend: `npx --yes tsx@4 file.ts` works for one-off checks (Node 22 has a global WebSocket and sends no Origin header).
- Scratchpad hazard: never name a scratch Python file after a stdlib module (a `tokenize.py` broke PIL).
- GameHost verification in headless Edge: the sandboxed (opaque-origin) iframe runs out of process, so DevTools `Runtime.evaluate` inside it needs `Target.setAutoAttach {flatten: true}` and the iframe target's `sessionId`. React StrictMode mounts the lab twice in dev (first host disposed at once). Stop the dev server by the PID listening on 5173.
- Fake-gcs (dev storage at localhost:4443) answers `Access-Control-Allow-Origin: *`; a real bucket needs CORS for the web origin (G7).
- The fixture's artifact must be rebuilt (`npm run fixtures`) after SDK or game changes; `dist/` is git-ignored. The backend embeds a copy (`../playhoot/play/session/internal/migrations/seeddata/space_drift_frontend.html`); a changed game needs a NEW backend seed version, never an edit (versions are pinned by Sessions).
- Two-player e2e: two headless Edge processes with separate profiles (ports 9351/9352); credentials test-user-2 and test-guest (`kind: 'guest'`). Display names come from the backend's fixed test users ("Test user 1", "Test user 2", "Guest"); the frontend prefers the name typed on the device for its owner.
- Backend integration tests need TEST_DATABASE_* (copy from ../playhoot/.env DATABASE_*); without them they skip silently.
- End-to-end Session Play runs (2026-10-20): temporary DB `playhoot_fe_e2e` (create, `DATABASE_NAME=playhoot_fe_e2e go run .` in ../playhoot, drop WITH (FORCE) after); browser credential injected as `{token:'test-user-2', userUUID:'aaaaaaaa-aaaa-4aaa-8aaa-000000000002', kind:'account'}`; host via REST + admin WS (`start_session`, `select_perspective` to read the authoritative view). To cut the connection without the Vite client reloading the page, run Vite with `PLAYHOOT_BACKEND_URL` pointing to a local TCP proxy and destroy its sockets (restarting Vite makes its client reload the page).
- Human preference (2026-10-20): they will not read this repo's code; keep `docs/logic/` (FLOWS.md + Go pseudocode mirror of state, external calls and navigation, no presentation) current with every logic change.
