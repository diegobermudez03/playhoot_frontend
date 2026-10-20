# Knowledge Map

Status: CANONICAL ROUTING MAP

This is a machine-facing routing document. It does not explain Playhoot. It tells AI agents where to retrieve authoritative context for the FRONTEND repository, and when to go to the backend repository (`../playhoot`).

## Routing Rules

- Do not scan all Markdown files.
- Load only task-relevant context.
- Code and tests are authoritative for actual implemented behavior.
- Accepted canonical documents are authoritative for accepted design.
- For backend behavior, the backend code is authoritative; this repository only keeps a reference snapshot.

## Routing Table (this repository)

| Need | Canonical | Status |
| --- | --- | --- |
| Frontend architecture rules, invariants, layout, layers | `ARCHITECTURE.md` | AVAILABLE |
| Full architecture skeleton / rationale (§N references) | `docs/Playhoot_Frontend_Architecture_Plan.docx` | AVAILABLE (.docx; see `AGENTS.md` for how to read it) |
| What is actually implemented | `CURRENT_STATE.md`, then code/tests | AVAILABLE |
| Behavior for the human: flows, external calls, global/feature state, navigation (prose + Go pseudocode) | `docs/logic/FLOWS.md`, `docs/logic/mirror/` | AVAILABLE (must be kept in sync with code) |
| Visual identity, design tokens, motion, sound, UI components, UI voice | `docs/design/DESIGN_SYSTEM.md` (living style guide at `/design` in dev) | AVAILABLE |
| Images, sounds, music the app uses; which are missing | `docs/design/ASSETS.md`, registry `apps/web/src/assets/assets.json`, `npm run assets` | AVAILABLE |
| Languages, message catalogs, how to write user-facing text | `docs/engineering/standards/user-facing-text.md`, catalogs in `apps/web/src/i18n/messages/` | AVAILABLE |
| A package's responsibility and boundaries | `<package>/README.md` (`apps/*`, `packages/*`, `packages/features/*`) | AVAILABLE |
| Game <-> Host bridge (message catalog, versioning, artifact loading, sandbox) | `docs/decisions/architecture/ADR-0005-game-host-bridge-protocol-v1.md`, code in `packages/protocol/src/bridge/` | PROPOSED |
| Fixture games for end-to-end work, GameHost lab | `fixtures/games/<game>/README.md`, `/dev/game-host` (`apps/web/README.md`) | AVAILABLE |
| Backend client-facing contract (HTTP, WS, auth, limits, gaps) | `docs/architecture/BACKEND_CONTRACT.md`, verified against backend code | REFERENCE SNAPSHOT |
| Frontend architecture decision rationale | `docs/decisions/architecture/INDEX.md` and referenced ADRs | AVAILABLE |
| Decision-record process/template | `docs/decisions/README.md`, `docs/decisions/templates/` | AVAILABLE |
| Engineering standards | `docs/engineering/standards/INDEX.md` | AVAILABLE (none accepted yet) |
| Engineering recommendations / future concerns | `docs/engineering/ENGINEERING_RADAR.md` | AVAILABLE / NON-AUTHORITATIVE |
| Active project dashboard | `docs/projects/active/<project-slug>/PROJECT.md` | AVAILABLE |
| Active project end-state checklist | `docs/projects/active/<project-slug>/CHECKLIST.md` | AVAILABLE when the project uses one |
| Project continuity for agents | `docs/projects/active/<project-slug>/internal/AI_CONTEXT.md` | TEMPORARY / NON-AUTHORITATIVE |
| Project-grouped WORK | `docs/projects/active/<project-slug>/works/` | AVAILABLE |
| Completed project history | `docs/projects/completed/<project-slug>/` | AVAILABLE |
| Project process/template | `docs/projects/README.md`, `docs/projects/templates/` | AVAILABLE |
| Standalone WORK (active / completed) | `docs/work/active/`, `docs/work/completed/` | AVAILABLE |
| WORK lifecycle/template | `docs/work/README.md`, `docs/work/templates/` | AVAILABLE |
| AI development behavior, execution surfaces, authority | `docs/ai/OPERATING_MODEL.md` | AVAILABLE |
| Natural request routing, cross-repository concerns | `docs/ai/protocols/CONVERSATIONAL_ORCHESTRATOR.md` | AVAILABLE / AGENT-FACING |
| Implementation / independent review protocol | `docs/ai/protocols/IMPLEMENTATION_REVIEW.md` | AVAILABLE / AGENT-FACING |
| Other agent protocols | `docs/ai/protocols/*` | AVAILABLE / AGENT-FACING |
| Human process guides | `docs/ai/README.md`, `docs/ai/processes/*` | AVAILABLE / HUMAN-FACING |
| Workspace mechanics | `docs/ai/workspaces/README.md` | AVAILABLE |
| Temporary exploratory initiative workspace | `docs/ai/workspaces/active/<initiative>/` | TEMPORARY / NON-AUTHORITATIVE |
| AI workflow evolution history | `docs/ai/CHANGELOG.md` | HISTORICAL |

## Routing Table (backend repository, `../playhoot`)

Load these only when the task needs backend truth. Enter through the backend's own `AGENTS.md` when CHANGING the backend.

| Need | Where |
| --- | --- |
| Product vision / scope / roadmap | `PROJECT_OVERVIEW.md`, `docs/product/PRODUCT_STATE.md`, `docs/product/ROADMAP.md` |
| Product decisions (PDRs) | `docs/decisions/product/INDEX.md` |
| Backend global architecture | `ARCHITECTURE.md` |
| HTTP/WS wire protocol as documented by the backend | `api/README.md` (known drift: see `docs/architecture/BACKEND_CONTRACT.md`) |
| Session Runtime state and flows | `play/CURRENT_STATE.md`, `play/docs/FLOWS.md`, `play/docs/decisions/INDEX.md` |
| Session Runtime architecture plan (backend) | `plans/session_runtime/Playhoot_Session_Runtime_Architecture_Plan_with_TOC.docx` |
| Backend active project (session runtime) | `docs/projects/active/session-runtime-v1/PROJECT.md`, `CHECKLIST.md` |
| Identity | `identity/README.md`, `identity/CURRENT_STATE.md` |
| Actual wire types | `api/play/*.go`, `api/identity/*.go`, `api/internal/auth/auth.go`, `play/runtime/runtime.go` |
