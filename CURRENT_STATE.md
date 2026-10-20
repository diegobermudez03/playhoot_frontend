# Current State

Status: CURRENT IMPLEMENTATION STATE (describes what exists, never what is planned)
Last updated: 2026-10-19

Planned work lives in `docs/projects/active/`. Accepted design lives in `ARCHITECTURE.md`.

| Area | State | Notes |
| --- | --- | --- |
| Workspace / tooling | Scaffolded | npm workspaces, TypeScript strict, Vite, ESLint (with boundary rules), Prettier, Vitest. `npm run check` passes. Tooling choices are PROPOSED (ADR-0001). |
| `apps/web` | Scaffold | Vite + React + React Router. Routes `/` (placeholder), `/join/:joinCode` (shows the code, does nothing), catch-all. No bootstrap, no state, no backend calls, no dev proxy. |
| `apps/mobile` | Not started | README only (plan step 11). |
| `packages/app-core` | Empty | Entry point only. |
| `packages/protocol` | Empty | Entry point and `./bridge` subpath only. |
| `packages/communication` | Empty | Entry point only. |
| `packages/device` | Empty | Entry point only. |
| `packages/game-host` | Empty | Entry point only. |
| `packages/game-sdk` | Empty | Entry point only. |
| `packages/features/session-join` | Empty | Entry point only. |
| `packages/features/session-play` | Empty | Entry point only. |
| `fixtures/games` | Empty | |
| Tests | None | Vitest configured with `passWithNoTests`. |

## Placeholders Left Behind

Every stub/stand-in that pretends to do something gets a line here and in the active Project's CHECKLIST.

- None yet.
