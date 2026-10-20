# Current State

Status: CURRENT IMPLEMENTATION STATE (describes what exists, never what is planned)
Last updated: 2026-10-20

Planned work lives in `docs/projects/active/`. Accepted design lives in `ARCHITECTURE.md`.

| Area | State | Notes |
| --- | --- | --- |
| Workspace / tooling | Working | npm workspaces, TypeScript strict, Vite, ESLint (with boundary rules), Prettier, Vitest. `npm run check` passes. Tooling choices are PROPOSED (ADR-0001). |
| `apps/web` | Foundation | Composition root (`src/app/services.ts`) builds app state, HTTP client, identity client and device store once; bootstrap resolves the persisted credential and starts the device watcher before the first render. React bindings: `useServices`, `useAuth`, `useDeviceCapabilities`. Data router with root layout, route error boundary, routes `/` (placeholder), `/join/:joinCode` (shows the code, does nothing), catch-all. Browser adapters: credential in `localStorage` (validated, tolerant of blocked storage), device capability detection and watching. Dev server proxies `/v1` (REST + WebSocket) to `PLAYHOOT_BACKEND_URL` (default `http://localhost:8081`). |
| `apps/mobile` | Not started | README only (plan step 11). |
| `packages/app-core` | Foundation | Credential model and ports (`CredentialStore`, `CredentialProvider`), `AuthSnapshot` (unknown / none / guest / authenticated), `createAppState` (bootstrap, signIn, signOut). |
| `packages/protocol` | Started | Backend HTTP error body and auth/rate-limit codes; `POST /v1/guests` request/response with zod validation. `./bridge` subpath empty. No realtime contract yet. |
| `packages/communication` | Started | `createHttpClient` (credential attached automatically, `Result` with `network` / `http` / `decode` failures, Retry-After, forgets a `token_invalid` credential); `IdentityClient.createGuest`. No realtime client. |
| `packages/device` | Foundation | `DeviceCapabilities`, `classifyDisplay`, capabilities store. |
| `packages/game-host` | Empty | Entry point only. |
| `packages/game-sdk` | Empty | Entry point only. |
| `packages/features/session-join` | Empty | Entry point only. |
| `packages/features/session-play` | Empty | Entry point only. |
| `fixtures/games` | Empty | |
| Tests | Unit | app state, HTTP client, identity client, display classification, browser credential store (18 tests). |

## Placeholders Left Behind

Every stub/stand-in that pretends to do something gets a line here and in the active Project's CHECKLIST.

- None. (Keyboard detection on web is a documented heuristic, not a stand-in.)
