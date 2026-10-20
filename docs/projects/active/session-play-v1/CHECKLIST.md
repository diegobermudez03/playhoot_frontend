# Session Play v1 - Completion Checklist

Status: ACTIVE TRACKING (non-authoritative for design; the plan and `ARCHITECTURE.md` own behavior)

Source of behavior: `docs/Playhoot_Frontend_Architecture_Plan.docx` ("plan", `§N`). Backend facts: `docs/architecture/BACKEND_CONTRACT.md` (G-numbers are its gaps). Section K (observability) expands plan §17; section Z (backend dependencies) is this project's addition.

## How To Use

- This is an end-state list, not a task order. The human directs the implementation order.
- Tick `[x]` only when the behavior is implemented AND verified (test or other concrete evidence). Code that merely exists is not done.
- Optionally append an owner/evidence note, e.g. `- WORK-0001` or `(2026-10-20: test X)`.
- If the human's instructions skip an item, or an instruction conflicts with a plan requirement, raise it before ticking anything.
- `(decision)` marks items that need a human decision before implementation.
- `(backend)` marks items that need a backend change (see Z).

---

## A. Repository foundation (§3.3, §18 step 1)

- [x] Monorepo with `apps/*`, `packages/*`, `packages/features/*`; each package has a README with what it owns and does not own (2026-10-19)
- [x] Web app builds and serves (React + TS); typecheck, lint, format check and tests run from the root (`npm run check`, 2026-10-19)
- [x] Package boundaries lint-enforced: packages never import apps/platform renderers/routers; game-sdk imports only the bridge protocol (2026-10-19, `eslint.config.js`; verified with temporary violating imports of `react`, `react-dom` and `@playhoot/app-core`)
- [x] Tooling accepted (ADR-0001, accepted by the human 2026-10-20)
- [ ] Routing skeleton: URL decides the open feature; unknown route handled; refresh on any route works in dev and in the production build (history fallback) (2026-10-20: data router with a root layout, a route error boundary and a catch-all; Vite serves the SPA fallback in dev and `vite preview`. Open: the production hosting fallback, which depends on how the web app is deployed)
- [x] Minimal AppGlobalState: auth/identity snapshot (unknown/loading, authenticated, guest, none) readable by every feature (§4.4, §14) (2026-10-20: `createAppState` in app-core, a zustand vanilla store; `useAuth()` in the web app; unit tests)
- [x] Credential provider + persistence of the guest/test token in the browser; never in URL (§19; `localStorage` accepted by the human 2026-10-20) (2026-10-20: implemented with `localStorage`, validated on read and degrading to "no credential" when storage is blocked; the communication layer reads the token through `CredentialProvider`; unit tests.)
- [x] Communication abstractions: HTTP client with automatic credentials and typed errors (branch on backend `code`), no caller passes tokens (§4.3) (2026-10-20: `createHttpClient` returns `Result` with `network` / `http` (status, code, message, Retry-After) / `decode` failures and forgets a credential the backend calls `token_invalid`; `IdentityClient.createGuest`; unit tests, plus `POST /v1/guests` and a `token_invalid` answer checked against the real backend through the dev proxy)
- [ ] DeviceCapabilities provider (web adapter): touch, keyboard, pointer, gamepad, viewport, orientation/display class (§7) (2026-10-20: abstraction, display classification (compact < 600 px <= medium < 1024 px <= wide) and store in `@playhoot/device`, unit tests; browser adapter in `apps/web/src/platform` keeps it current on resize, orientation, pointer and gamepad changes; `useDeviceCapabilities()`. Pending: checking the browser adapter in a real browser. Keyboard is a heuristic: assumed when a fine pointer exists)
- [ ] Dev setup against the local backend (same-origin proxy for REST and WS, or allowed origin) documented and working (Z1) (2026-10-20: Vite proxies `/v1` with `ws: true` and without `changeOrigin`, target `PLAYHOOT_BACKEND_URL`; REST verified against the real backend, and WebSocket handshakes reach the backend routes with the token subprotocol. Pending: one real upgrade, which proves the backend's origin check passes; blocked locally because the local database is behind the backend's schema and Create Session fails)
- [x] App bootstrap sequence (§13.1) does not block the whole UI; features can represent unknown/loading auth (2026-10-20: `startServices` resolves the persisted credential synchronously and starts the device watcher before the first render; the snapshot starts as `unknown`; covered by the app-core tests)

## B. Join Session (web) (§5, §13.2, §14, §18 step 2)

- [ ] `/join/:joinCode` opens the join experience directly, without passing through Home, and survives refresh
- [ ] `/sessions/:sessionUUID/play` connects directly as a player through the Session UUID (shareable; lobby join or reattach/rejoin depending on the Session) (ADR-0002)
- [ ] Missing identity → guest setup (`POST /v1/guests` with display name + idempotency key) or test-token selection, then continue the join (UX only; backend decides)
- [ ] Join state reads AppGlobalState and the DeviceCapabilities the join needs
- [ ] Join opens the backend join flow through communication (`/v1/play/join/{joinCode}`) — the realtime connection IS the join
- [ ] Rejections rendered as typed reasons with a next action: invalid/expired code, `lobby_full`, `session_started`, `session_unavailable`, auth errors, rate limits, `server_busy` (note: pre-upgrade HTTP errors are invisible to the browser WebSocket; decision: how to distinguish them, e.g. a pre-flight check)
- [ ] Lobby state shown while waiting for start (`lobby_update`), including `lobby_closed`
- [ ] Code join replaces its URL with `/sessions/:sessionUUID/play` as soon as the Session UUID is known, and Session Play runs there (ADR-0002; depends on Z2)
- [ ] Leaving the lobby (`leave`) and navigating away dispose the feature state
- [ ] Backend `401/403` respected even when the local snapshot said authenticated (§14)

## C. Realtime SessionClient (§4.3, §13.4-§13.7, §18 step 3)

- [ ] SessionClient owns the WebSocket: subprotocols `playhoot.v1` + bearer token subprotocol; feature state never touches the raw socket
- [ ] Typed inbound message decoding + runtime validation of the platform protocol; unknown/invalid server messages handled as protocol errors
- [ ] Semantic event subscription (lobby, started, view, command result, leave result, rejected, terminal)
- [ ] SAMPLE: per-connection sequence starting at 1 on every new connection; full logical input snapshot; respects 60/s limit
- [ ] COMMAND: idempotency token generated/reused by the platform layer; `command_result` correlated by token; `rate_limited` retried with the same token (§13.5)
- [ ] View application: FULL replaces; patch applied with backend merge semantics (objects recursive, arrays/scalars replaced, `null` is a value); revision gap → `resync`; ack-only views advance ack only
- [ ] Ack (`consumed_through_sample_sequence`) exposed for prediction/reconciliation (§15)
- [ ] Transient errors/events delivered once, never re-emitted on resync
- [ ] Reconnect: transport loss → `reconnecting`; reattach within grace via the session player endpoint; after reattach send current full SAMPLE immediately; `session_started` + FULL view on reattach treated as a resync baseline (§13.7)
- [ ] Rejoin after grace; `participant_disconnected` / `rejoin_rejected` → terminal for this player
- [ ] Close-code handling: 1000 reasons (`replaced` = do not reconnect, `left`, `session_ended`, `disconnected`), 1001/1006/1011/1012 → reconnect with backoff respecting handshake rate limits (5/s, 30/min per user), 1007/1008 → protocol error, not retried blindly
- [ ] Terminal: `session_ended` / `lobby_closed` with status and end cause → terminal state
- [ ] Explicit leave vs navigate-away semantics (§13.8) (decision: does navigating away send `leave`, or only close the socket?)

## D. WebGameHost minimal (§10, §13.3, §16, §18 step 4)

- [ ] `GameHost` abstraction used by Session Play; WebGameHost is its iframe implementation
- [ ] Artifact obtained by the Host (signed URL from `session_started`), SHA-256 verified, cached by hash; URL/credentials never given to the game (decision: fetch + blob/srcdoc vs iframe src; depends on G5, G7)
- [ ] Sandboxed iframe with a minimal sandbox (`allow-scripts` only unless explicitly needed) and restrictive CSP/origin strategy
- [ ] Versioned bridge established (protocol version negotiated) + READY handshake with timeout
- [ ] After READY: initial platform context + current FULL projection sent to the game
- [ ] Container disposed on route/session end; no leaked listeners
- [ ] Artifact failure states: not loading, hash mismatch, READY timeout, unsupported bridge version → typed GameHost errors

## E. Playhoot Game SDK minimal (§9, §11, §18 step 5)

- [ ] Bridge protocol defined in `@playhoot/protocol/bridge`, versioned, with runtime validation on the Host side (decision: message catalog and names, §19)
- [ ] SDK API: projection updates, events, command responses, `sample`, `command`, `requestAsset` (minimal), READY
- [ ] SDK has no Host/framework dependency (lint) and works with any game framework
- [ ] Host validates every inbound bridge message (type, payload, context/role) even from the official SDK; invalid messages rejected and recorded
- [ ] Host validates SAMPLE/COMMAND against the GameVersion contract before sending (needs the manifest or its frontend-relevant part on the client: Z6)
- [ ] A small real game built as an artifact with the SDK (`fixtures/games`), matching a backend game (e.g. Space Drift), used end to end
- [ ] Game build pipeline produces a single artifact the backend can store/serve (depends on Z4)

## F. Session Play vertical slice (§12, §13, §18 step 6)

- [ ] SessionPlayState: lifecycle (loading/lobby/running/terminal), connection (connecting/connected/reconnecting/disconnected), identity + role (`participant_id`, roster), current projection + revision baseline, platform messages/errors, artifact metadata, GameHost readiness
- [ ] `/sessions/:sessionUUID/play` reconstructs Session Play from URL + backend after refresh (ADR-0002)
- [ ] Real Session: join, start (by admin via API/dev tool), load GameVersion, see projection, send SAMPLE/COMMAND, receive events/responses, end
- [ ] Short disconnection tolerated: reconnect + resync, game receives an authoritative full resync
- [ ] Leaving the route disposes subscriptions, GameHost and connection; returning rebuilds (§13.8)
- [ ] Terminal states shown with status/cause

## G. Fixed-aspect game viewport (§8, §18 step 7)

- [ ] GameVersion declares a logical viewport/aspect ratio (backend, Z5) and the Host reads it
- [ ] Host fits, centers, letterboxes/pillarboxes; never stretches
- [ ] Resize/orientation change changes host space, not the game's logical coordinate system
- [ ] Pointer/touch positions normalized to the logical viewport
- [ ] Safe areas and browser chrome handled by the Host around the viewport

## H. Adaptive presentation (§6, §18 step 8)

- [ ] Join and Play have portrait/compact and landscape/wide variants consuming the same feature state
- [ ] Variant selector lives at the presentation edge; no scattered device conditionals
- [ ] Responsive behavior inside each variant

## I. Hardening (§16, §17, §18 step 9)

- [ ] iframe CSP/sandbox hardened and reviewed; no `window.parent` business API; no Host objects exposed
- [ ] Bridge validation hardened: size limits, rate protection on game → host messages
- [ ] Asset delivery through the Host with safe handles (depends on Z4)
- [ ] Frontend-side rate/size protections aligned with backend limits (32 KiB message, per-type rates)
- [ ] Reconnect/resync tests (automated) covering grace reattach, rejoin, revision gap, collapse to FULL, owner change (1012)

## J. Completion gate (§18)

- [ ] A user opens a join link directly, resolves identity, establishes the Session, loads the isolated GameVersion artifact, plays via SAMPLE/COMMAND, receives projections/events, tolerates a short disconnection, and rebuilds from route/backend without relying on page memory — demonstrated end to end against the real backend

## K. Observability (§17)

- [ ] Errors classified by origin: presentation, bridge/contract, transport, backend logical rejection, artifact/GameHost
- [ ] Metrics/events captured: artifact load time, time to GameHost READY, reconnect count, bridge validation failures, WS disconnects, resync count, artifact errors (decision: where they are sent; console/dev sink acceptable initially)

## L. Global bootstrap and visibility (§14, §18 step 10)

- [ ] Bootstrap/me capabilities consumed when the backend provides them; visibility centralized, never treated as authorization (backend: no endpoint exists yet; may move out of scope by human decision)

## M. Invariants verification (ARCHITECTURE.md "Invariants")

- [ ] Game never receives tokens, the real WebSocket, signed URLs or backend access (test/inspection)
- [ ] Same artifact contract usable by a future WebView host (no web-host-only assumptions in SDK/bridge)
- [ ] Feature state discarded on route exit; rebuild from URL + backend (test)
- [ ] Feature state knows semantic operations only (no WebSocket/iframe types in feature packages)

---

## Z. Backend dependencies (changes in `../playhoot`, made through its workflow when the human directs)

- [ ] Z1. Local development across origins: REST CORS or documented same-origin proxy; `WEBSOCKET_ALLOWED_ORIGINS` for the dev origin (G1, G2) (2026-10-20: solved without a backend change for development by the same-origin proxy (A); a deployment on separate origins would still need CORS and allowed origins)
- [ ] Z2. A player who joined by code learns the Session UUID, so the frontend can compose `/sessions/:sessionUUID/play` (ADR-0002) and reconnect after start (G4) (backend; proposal: `session_uuid` in `lobby_update` and `session_started`)
- [ ] Z3. Frontend artifact access survives reconnects after 15 min: re-sign on reattach/rejoin/attach, or the frontend caches by hash (G5) (decision)
- [ ] Z4. Game frontend artifact format and assets: what a package is (single HTML vs bundle), how assets are stored, referenced by logical key and resolved through the Host (G6, plan §9, §13.3) (backend, decision)
- [ ] Z5. GameVersion frontend metadata: logical viewport / aspect ratio, bridge/SDK version, entry (G6, plan §8) (backend, decision)
- [ ] Z6. The client gets what it needs to validate SAMPLE/COMMAND before sending (frontend-relevant manifest part) or validation stays backend-only (G6) (decision)
- [ ] Z7. Signed artifact URL readable by the Host (bucket/emulator CORS) if the Host fetches it (G7)
- [ ] Z8. `leave` during a Start attempt answered instead of closing with 1011 (G8)
- [ ] Z9. Real identity enough for multiple distinct guests in one session (G3) (backend; may stay out of scope for this project by human decision)

## Placeholders Left Behind

Every frontend stub/stand-in that pretends to do something gets a line here and in `CURRENT_STATE.md`.

- None yet.
