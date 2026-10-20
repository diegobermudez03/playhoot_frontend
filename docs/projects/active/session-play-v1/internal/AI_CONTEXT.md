Process: Project execution (session-play-v1), human-directed implementation
Topic: First web vertical slice (join link -> join -> play) per docs/Playhoot_Frontend_Architecture_Plan.docx
Current stage: plan step 3 (realtime client) implemented and verified 2026-10-20; design accepted and made token-driven, animated, with sound and an asset registry the same day; earlier: i18n, Join Session, backend Z2, foundation
Current execution surface: CODEBASE AGENT
Related durable artifacts: docs/projects/active/session-play-v1/PROJECT.md, docs/projects/active/session-play-v1/CHECKLIST.md, docs/Playhoot_Frontend_Architecture_Plan.docx, ARCHITECTURE.md, docs/architecture/BACKEND_CONTRACT.md, docs/decisions/architecture/ADR-0001-workspace-tooling-for-the-frontend-foundation.md
Blocked by: nothing (open human decisions in PROJECT.md; a real WS upgrade check waits for the human's local DB to match the backend schema)
Next action: wait for the human; by the plan, step 4 (WebGameHost) / step 5 (Game SDK); the human sources assets from docs/design/ASSETS.md
Last durable checkpoint: realtime client + motion/sound/assets; CHECKLIST C, CURRENT_STATE, DESIGN_SYSTEM, ASSETS, ADR-0003/0004 accepted, AGENTS, KNOWLEDGE_MAP, PROJECT updated (2026-10-20)
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
