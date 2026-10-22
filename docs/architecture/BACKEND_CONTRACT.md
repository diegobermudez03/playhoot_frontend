# Backend Contract (frontend reference)

Status: REFERENCE SNAPSHOT — the backend code is the authority
Backend ref inspected: `../playhoot` at `36d0c9d` (2026-10-19), plus `e4f0d85` (2026-10-20, `session_uuid` on lobby/start messages, G4), plus the aspect-ratio change (`552ce77`, `frontend.viewport`, G6), plus the uncommitted game fault reports (2026-10-20, `game_fault`, ADR-0006)

This document records the client-facing contract that the backend ACTUALLY implements, as the frontend needs it. It does not define the contract; the backend owns it (`../playhoot/api/README.md`, `../playhoot/play/CURRENT_STATE.md`, and the code). Paths below are relative to the backend repository.

Rules for this file:

- Record only what the backend implements. Future/desired contract goes to the active Project's backend dependencies, not here.
- When code and this file disagree, the code wins: report the drift and update this file.
- Re-verify a section against the code before building on it if the backend has moved since the ref above.

## 1. Gaps that block or shape the frontend

| # | Gap | Impact | Source |
| --- | --- | --- | --- |
| G1 | No CORS on REST routes | Browser calls from another origin fail preflight. Dev: handled by the same-origin Vite proxy (`apps/web/vite.config.ts`). | no CORS code in `api/` |
| G2 | WS origin check | Dev origin must be in `WEBSOCKET_ALLOWED_ORIGINS` (e.g. `localhost:5173`) unless proxied keeping the Host header (what the Vite proxy does). | `api/internal/wsx/wsx.go:32-35`, `main.go:258` |
| G3 | Identity is a placeholder | `POST /v1/guests` always returns the same guest (`test-guest`); only tokens `test-user-1`, `test-user-2` (accounts) and `test-guest` exist, named "Test user 1", "Test user 2" and "Guest" (2026-10-20: `lobby_update`, `session_started` and the new player message `roster_update` carry `display_name`; `roster_update` also carries each participant's `status`: active, reconnecting, disconnected, left). Display names typed at guest creation are still not stored and no endpoint maps `user_uuid` to a name. | `identity/usecases/createguest/service.go`, `identity/usecases/authorize/service.go:22-26` |
| G4 | RESOLVED 2026-10-20: the join code is still released at Start, but every `lobby_update` and `session_started` now carries `session_uuid` | The frontend replaces `/join/:joinCode` with `/sessions/:sessionUUID/play` (ADR-0002) and reconnects by Session. | `api/play/live_connection.go`, `api/play/player_join.go`, `api/play/admin_join.go` |
| G5 | RESOLVED 2026-10-20: the frontend URL (TTL 15 min) is signed again for every connection that attaches to a running game (reattach, rejoin, device switch, admin); a failed signing falls back to the start's | The GameHost still caches by hash, so a reload or reconnect usually needs no download at all. | `play/session/usecases/frontendaccess/service.go:36`, `step_start_session.go:404`, `step_reattach_player.go:46` |
| G6 | Game frontend package is a single self-contained HTML file (Space Drift's seed version `...c2` holds the real one built here, `fixtures/games/space-drift`); no assets; no frontend fields in the manifest (entry, capabilities); manifest never sent to the client. Aspect ratio: solved 2026-10-20 outside the manifest (`play_game_versions.aspect_ratio`, sent as `frontend.viewport`) | Assets and the SDK contract need backend work. The game must know its own inputs/commands. | `play/session/internal/migrations/seed_objects.go`, `play/session/internal/business/manifest/manifest.go` |
| G7 | Signed GCS URL CORS: fake-gcs in dev answers `Access-Control-Allow-Origin: *` (checked 2026-10-20); a real bucket's CORS is unknown | The GameHost fetches the artifact and checks its hash (ADR-0005), so production needs bucket CORS for the web origin. | `play/session/internal/objectstore/gcs.go:119-136` |
| G8 | `leave` during a Start attempt closes with 1011 | Treat as a transport error. | `step_leave_player.go:20-23` |
| G9 | No Game <-> Host bridge exists anywhere | Defined by this repository (it was out of the backend's scope): ADR-0005. | backend `docs/projects/active/session-runtime-v1/PROJECT.md:16` |

Backend doc drift seen (code wins): `api/README.md` shows paths without `/v1` and `/play/join`, says `lobby_closed` is sent "once the Session starts" and "Bearer <jwt>" (tokens are opaque); `play/CURRENT_STATE.md` mentions a non-existent `session_aborted`.

## 2. HTTP

Every route: observability -> authorization -> rate limit -> route (`api/server.go:47-103`). Error body: `{"code"?: string, "message": string}` (`api/internal/httpx/json.go:14-17`); branch on `code`.

### `POST /v1/guests` (no auth)

- Request `{"display_name": string (1..64 runes), "idempotency_key": UUID}`, body <= 4 KiB.
- `201 {"user_uuid", "token"}`; `400` invalid body/key/name; `409` idempotency conflict; `500`.

### `POST /v1/client-telemetry` (Bearer, `REPORT_CLIENT_TELEMETRY`, guests too)

- Body `{"events":[...]}`: at most 100 events, 16 KiB. `204` whatever the events held; `400` for a body that is not a batch or too many events. General per-user limits apply (5/s, 30/min).
- Closed catalog (`api/clienttelemetry/catalog.go`): `artifact_load {duration_ms, cached}`, `game_ready {duration_ms}`, `connection_lost {close, count?}`, `reconnect {outcome, count?}`, `resync {count?}`, `bridge_refusal {reason, count?}`, `error {origin, kind, count?}`; durations 0..600000 ms, counts 1..10000. Anything else is dropped and counted by the backend. Mirrored in `@playhoot/protocol` (`clientTelemetry.ts`). Recorded as `client_*` metrics, which today reach the backend's logs only (2026-10-21, ADR-0007).

### `POST /v1/sessions` (Bearer, `CREATE_SESSION`, accounts only)

- Request `{"game_uuid": UUID, "idempotency_key": string 1..128}`.
- `201 {"session_uuid", "join_code", "lobby_expires_at" (RFC3339)}`. Lobby TTL 30 min. Join code: 6 chars from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, case-insensitive.
- `404` game not playable; `409`; `400`; `401`/`403`.
- The creator is not a player; to play they also open a player connection.

Seed games (non-production): `11111111-1111-4111-8111-111111111111` (input `move` vector2, 1-8 players); `22222222-...` (unavailable); `33333333-3333-4333-8333-333333333333` **Space Drift** (inputs `move` vector2, `boost` boolean; command `teleport{x,y}`; `update`, `playerRejoined`; 1-8 players); `44444444-4444-4444-8444-444444444444` **Parqués** (no inputs; commands `roll{}` and `move{piece 0-3, die a|b|sum}`, answering `{ok, reason?, dice?}`; `update`, `playerRejoined`; 2-4 players; frontend `fixtures/games/parques`).

### Auth (`api/internal/auth/auth.go`)

| Status | `code` |
| --- | --- |
| 401 (+`WWW-Authenticate: Bearer`) | `token_required` |
| 401 | `token_malformed`, `token_invalid` |
| 403 | `operation_forbidden` (guest creating a session or joining as admin) |

- REST: `Authorization: Bearer <token>`.
- WebSocket from a browser: subprotocols `["playhoot.v1", "base64url.bearer.authorization.playhoot." + base64url_unpadded(token)]`. The server selects only `playhoot.v1`.
- Operations: `CREATE_SESSION`, `JOIN_SESSION_AS_ADMIN` (accounts); `JOIN_SESSION_AS_PLAYER` (guests allowed).

## 3. WebSocket routes

| Route | Role |
| --- | --- |
| `GET /v1/play/join/{joinCode}` | player (code resolved first) |
| `GET /v1/play/join/sessions/{sessionUUID}/player` | player |
| `GET /v1/play/join/sessions/{sessionUUID}/admin` | admin (creator only) |

Pre-upgrade failures are HTTP responses the browser `WebSocket` cannot read (it sees an error / close 1006): auth 401/403; 429 `rate_limited`; join code 400/404; session 400/404 (only LOBBY-before-expiry or RUNNING is joinable)/503; 429 `too_many_connections` (10 per user per instance); 503 `server_busy`; 400 missing `playhoot.v1`; origin mismatch.

Framing: text frames, JSON object with `type`. Max 32 KiB per message.

### Close codes

| Code | Meaning |
| --- | --- |
| 1000 | Runtime end; reason `session_ended`, `disconnected`, `left` or `replaced` (`replaced` = do not reconnect) |
| 1001 | Server shutting down |
| 1003 | Binary frame |
| 1007 | Invalid JSON / missing type / malformed sample, command or select |
| 1008 | Unknown type for this endpoint, rate limited, or admission rejected |
| 1009 | Message too big |
| 1011 | Server failure (also: recovery failed — retry) |
| 1012 | `owner_changed` — reconnect |
| (1006) | Dropped: slow consumer or no pong (ping every 15 s, 10 s to answer) |

### Admission

Upgrade first, then the Runtime admits or sends `{"type":"rejected","reason"}` + close 1008. Reasons: `session_unavailable`, `not_creator`, `session_started` (non-participant of a running game), `lobby_full`, `participant_disconnected` (game without `playerRejoined`), `rejoin_rejected`, `owner_changed`, `too_many_admins` (> 8), `server_busy`. While a rejoin waits for the game, the socket receives nothing until `session_started` or `rejected`.

### Player -> server

| type | fields | notes |
| --- | --- | --- |
| `sample` | `sequence` int > 0, `inputs` object | Full snapshot of logical inputs; omitted inputs take defaults. Never answered; acknowledged in views. Stale sequence ignored. Undeclared input / invalid value -> close 1007. **Each new connection restarts sequences at 1.** Dropped before the game runs. |
| `command` | `token` string 1..128, `name`, `payload?` object/null | Answered by `command_result`. |
| `resync` | — | A FULL `player_view` follows. |
| `leave` | — | `leave_result{outcome:"left"}` then close 1000 `left`. Lobby: leaves the lobby. Running: immediate disconnect (only rejoin brings the player back). |
| `game_fault` | `kind` one of `artifact_unreachable`, `artifact_hash_mismatch`, `ready_timeout`, `unsupported_bridge_version`, `container_violation`, `bridge_abuse`; `detail` object <= 2 KiB | Never answered. Kept for auditing in `play_game_faults` only from a current participant of the running game (one record per Session, player and kind, counted); otherwise dropped. Unknown kind or bad detail -> close 1007 (`api/play/player_join.go`, 2026-10-20, ADR-0006). |

### Admin -> server

| type | fields | answer |
| --- | --- | --- |
| `start_session` | — | `start_session_result.outcome`: `started`, `already_started`, `start_in_progress`, `not_in_lobby`, `invalid_player_count`, `game_unavailable`, `start_failed`, `sandbox_unavailable` |
| `cancel_session` | — | `cancelled` / `already_ended` |
| `select_perspective` | `participant_id` | `selected` (FULL view follows), `unknown_participant`, `creator_is_playing`, `session_not_running` |
| `resync` | — | FULL view of the watched participant |

### Server -> client

- `lobby_update` `{session_uuid, members: [{user_uuid}]}` — whole lobby, join order. Admin's first message. None after start.
- `session_started` — player: `{session_uuid, participant_id, participants: [{participant_id, user_uuid, display_name}], frontend: {url, sha256, expires_at, viewport: {aspect_ratio, width, height}}}`; admin: same without `participant_id`. `viewport` is the game version's fixed shape: `aspect_ratio` from a closed backend catalog (`16:9`, `9:16`, `4:3`, `3:4`, `1:1`; a game picks one, it cannot declare its own) and its logical resolution (1080 on the short side: 1920x1080, 1080x1920, 1440x1080, 1080x1440, 1080x1080), the size the game draws in and receives input in (`play/session/internal/business/gameversion/aspect_ratio.go`, `api/play/live_connection.go`). Participants `P1..Pn` in lobby order. Re-sent on every reattach/rejoin, followed by a FULL view.
- `player_view` (player) `{participant_id, full, revision, state, consumed_through_sample_sequence, errors?, events?}`.
- `player_view` (admin) `{participant_id, full, revision, state, events?}` — no ack, no errors.
- `command_result` `{token, outcome, response?}` — `executed` (response is the game's JSON, may be a game-rule rejection), `already_processed` (no response kept), `invalid`, `session_not_running`, `rate_limited` (token unused, may retry).
- `leave_result`, `start_session_result`, `cancel_session_result`, `select_perspective_result` — `{type, outcome}`.
- Terminal: `session_ended` / `lobby_closed` (the latter only if the client never saw `session_started`) `{status, end_cause}`, then close 1000 `session_ended`. An abort whose durable write failed closes without a terminal message.

### View semantics (`play/runtime/internal/business/viewpatch/viewpatch.go`)

- Patch = object with only changed fields; nested objects patched recursively; arrays and scalars replaced whole; `null` is a value. Fields never disappear (the server sends FULL instead). Not RFC 7396, not JSON Patch.
- Revision: FULL and patch = last + 1; ack-only view (`full:false, state:{}`) repeats the revision. A patch whose revision != last + 1 -> send `resync`.
- FULL views at start, reattach, rejoin, resync, perspective selection, and collapse (8 untaken views merged).
- `errors`/`events` are transient: delivered once, never on resync. Errors only to their own participant.
- Boundary every 100 ms; COMMAND/leave/rejoin force one. One view per player per boundary. Ack = highest SAMPLE sequence consumed on THIS connection.

### Reconnect

- Lobby: disconnect removes the player at once; reconnecting is a fresh join.
- Running, transport lost: inputs reset; 3 s grace. Reconnect to the same player endpoint within it = silent reattach (old connection closed `replaced`; `session_started` + FULL view; SAMPLEs restart at 1; the backend plan expects the client to send its current full SAMPLE immediately).
- After the grace: `playerDisconnected()`; coming back is a rejoin (game decides if it declares `playerRejoined`, else `participant_disconnected`).
- Server restart: the first reconnect recovers from the last checkpoint (<= 5 s old), 30 s recovery window.
- 1012: reconnect. `replaced`: do not reconnect.

## 4. Lifecycle and roles

- Durable status: `LOBBY`, `RUNNING`, `FINISHED`, `CANCELLED`, `EXPIRED`, `ABORTED`.
- End causes: `GAME_FINISHED` -> FINISHED; `HOST_CANCELLED`, `ALL_PLAYERS_LEFT`, `PLATFORM_TERMINATED` -> CANCELLED; `LOBBY_EXPIRED`, `INACTIVITY_TIMEOUT`, `MAX_LIFETIME` -> EXPIRED; `GAME_START_FAILURE`, `SCRIPT_FAILURE`, `UNRECOVERABLE_INFRA_FAILURE`, `OWNER_LOST` -> ABORTED.
- Roles: ADMIN (creator only, up to 8 connections, no SAMPLE/COMMAND, watches one participant); PLAYER (anyone with a token, including the creator, on a separate connection). No spectator.
- Timings: lobby 30 min; max lifetime 4 h; inactivity 10 min (no distinct SAMPLE transition or COMMAND); grace 3 s; recovery 30 s; frontend URL 15 min. No platform pause.

## 5. Manifest (not exposed to the client)

`{"schema_version":1, "players":{min,max}, "entrypoints":[...], "inputs":{name:{type,...}}, "commands":{name:{payload:{...}}}}`. Input types: `boolean`, `number` (min/max/default), `vector2` (`[x,y]`), `string` (<= 256 bytes, nullable), `enum` (values, default). <= 32 inputs, <= 64 commands, names `^[A-Za-z][A-Za-z0-9_]{0,63}$`.

## 6. Client limits

- HTTP: per user 5/s and 30/min per route (WS handshakes included: back off reconnect loops); per address 20/s, 300/min; 429 `rate_limited` + `Retry-After`.
- Per connection: 120 msg/s, 6000/min, 256 KiB/s, 4 MiB/min -> close 1008.
- `sample` 60/s (excess silently dropped); `command` 20/s (-> `rate_limited`); `resync` 2/s, 30/min; `leave` and `game_fault` share one lane, handled in order: 2/s, 20/min, 3 waiting (excess silently dropped). Every limit hit is also recorded by the backend for the Session's audit (`SERVER_LIMIT`), without changing the answer.
- Runtime: 120 distinct input transitions/s per participant; commands 10/s, 120/min per participant, 60/s per session, 4 pending per participant; 1000 tokens remembered per participant (retry soon).

## 7. Running the backend locally

In `../playhoot`: `docker compose up -d` (Postgres, fake-gcs on 4443, adminer on 8080), then `go run .` (loads `.env`, migrates and seeds outside production; HTTP on `HTTP_PORT`, 8081 in the local `.env`). GCS must be configured or Start fails (frontend URL signing). For a browser dev origin set `WEBSOCKET_ALLOWED_ORIGINS`.

Against the frontend dev server, use `http://localhost:5173` instead of the backend port: `/v1` is proxied.

Manual flow: `POST /v1/sessions` with `Bearer test-user-1` and Space Drift; players connect to `/v1/play/join/{code}` with `test-user-2` / `test-guest`; the admin connects to `/v1/play/join/sessions/{uuid}/admin` with `test-user-1` and sends `start_session`.
