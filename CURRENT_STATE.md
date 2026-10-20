# Current State

Status: CURRENT IMPLEMENTATION STATE (describes what exists, never what is planned)
Last updated: 2026-10-20

Planned work lives in `docs/projects/active/`. Accepted design lives in `ARCHITECTURE.md`.

| Area | State | Notes |
| --- | --- | --- |
| Workspace / tooling | Working | npm workspaces, TypeScript strict, Vite, ESLint (with boundary rules), Prettier, Vitest (ADR-0001). `npm run check` passes. |
| `apps/web` | Join Session | Composition root (`src/app/services.ts`): app state, HTTP client, identity client, session connector, device store; bootstrap before the first render. Routes: `/` (join-code entry), `/join/:joinCode` and `/sessions/:sessionUUID/play` (one pathless parent route serving Join Session, ADR-0002), `/design` (dev-only living style guide), catch-all, route error boundary. Design system in `src/ui/` (all values from `tokens.css`; Button, TextField, Card, CodeTiles, CodeInput, Avatar, Owl, Logo, AppShell, Starfield, Confetti; ADR-0003) with a shared motion vocabulary (`motion.css`). Sound: Web Audio player with mute toggle, placeholder tones for missing files, lobby music loop (`src/sound/`). Asset registry `src/assets/assets.json` (18 assets, 17 missing; `npm run assets`); favicon and web manifest in `public/`. Browser adapters: credential and language choice in `localStorage`, device capabilities. Internationalization: react-intl with ICU catalogs for `es`, `en`, `pt-BR` (ADR-0004), language picker in the top bar, `<html lang>` kept in sync, no literal text in JSX (lint). Dev proxy for `/v1` (REST + WebSocket). |
| `apps/mobile` | Not started | README only (plan step 11). |
| `packages/app-core` | Foundation | Credential (with optional local display name), ports, `AuthSnapshot`, supported languages and `resolveLocale`, `createAppState` (auth + language, persisted). |
| `packages/protocol` | Player protocol complete | HTTP: error body, auth/rate-limit codes, `POST /v1/guests`. Realtime: connection paths, subprotocols, close codes, limits, join-code alphabet; zod schemas for every player server message (`rejected`, `lobby_update`, `session_started`, `player_view`, `command_result`, `session_ended`, `lobby_closed`, `leave_result`); client `sample`, `command`, `resync`, `leave`. Admin messages not modeled. `./bridge` empty. |
| `packages/communication` | Realtime client | HTTP client and `IdentityClient`. `SessionConnector` / `SessionConnection`: player connection by code or Session UUID with the token subprotocol; message validation; close classification; `sample` (sequence per connection, coalesced to 60/s, size-checked), `command` (token correlation, retries `rate_limited` with the same token, `connection-closed` keeps the token for a later retry, size-checked), views reconciled by `createViewTracker`/`applyViewPatch` (FULL, patches, ack-only, gap → automatic resync), `resync`, `leave`. Verified against the real backend: 66 patches reconstructed the exact state of the server's FULL view; 213 samples all acknowledged; command executed / already_processed / invalid. Reconnection lives in the features (Join today). |
| `packages/device` | Foundation | `DeviceCapabilities`, `classifyDisplay`, capabilities store. |
| `packages/features/session-join` | Implemented | `createJoinSession`: identity (guest creation) → connecting → lobby → started, typed outcomes for every rejection and end, Session UUID learned from the backend, reconnection by Session UUID (3 attempts: 1 s, 2 s, 4 s; never after `replaced`), leave, dispose. Verified by unit tests and end to end against the real backend. |
| `packages/game-host` | Empty | Entry point only. |
| `packages/game-sdk` | Empty | Entry point only. |
| `packages/features/session-play` | Empty | Entry point only. After `session_started` the web app shows a placeholder screen. |
| `fixtures/games` | Empty | |
| `scripts/dev-host.mjs` | Dev tool | Creates a Session on the local backend as `test-user-1`, prints the join link, connects as admin, starts on Enter. |
| Tests | Unit | 10 files, 77 tests: app state and language resolution, HTTP client, identity client, session connection (lobby and play), view patching and tracking, join session, display classification, browser credential store, message catalog parity. No browser/e2e test suite in the repository (an end-to-end run was done by hand with headless Edge). |

## Placeholders Left Behind

Every stub/stand-in that pretends to do something gets a line here and in the active Project's CHECKLIST.

- "Game on! Loading the game…" screen after `session_started`: stands in for Session Play (plan step 6); nothing loads.
- Other players appear as "Player N": the backend returns no names (BACKEND_CONTRACT.md G3).
- `scripts/dev-host.mjs`: stands in for the host experience (create and start a Session).
