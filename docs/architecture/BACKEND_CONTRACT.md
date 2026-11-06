# Backend Contract (frontend reference)

Status: REFERENCE SNAPSHOT — the backend code is the authority
Backend ref inspected: `../playhoot` at `36d0c9d` (2026-10-19), plus `e4f0d85` (2026-10-20, `session_uuid` on lobby/start messages, G4), plus the aspect-ratio change (`552ce77`, `frontend.viewport`, G6), plus the uncommitted game fault reports (2026-10-20, `game_fault`, ADR-0006), plus the uncommitted join code refusal reasons and leave during a Start attempt (2026-10-21, Z10, Z8), plus the game assets and batch-signed frontend access (2026-10-25, Z4, backend SESSION-ADR-0034), plus the uncommitted player device check (2026-10-25, SESSION-ADR-0035) and readable refusals by Session UUID (2026-10-25)

This document records the client-facing contract that the backend ACTUALLY implements, as the frontend needs it. Value lists in it (reasons, statuses, outcomes) are what exists today, never complete: the frontend handles others with a default (`docs/engineering/standards/backend-contract-values.md`). It does not define the contract; the backend owns it (`../playhoot/api/README.md`, `../playhoot/play/CURRENT_STATE.md`, and the code). Paths below are relative to the backend repository.

Rules for this file:

- Record only what the backend implements. Future/desired contract goes to the active Project's backend dependencies, not here.
- When code and this file disagree, the code wins: report the drift and update this file.
- Re-verify a section against the code before building on it if the backend has moved since the ref above.

## 1. Gaps that block or shape the frontend

| # | Gap | Impact | Source |
| --- | --- | --- | --- |
| G1 | RESOLVED 2026-10-25 (uncommitted in the backend): REST CORS from `CORS_ALLOWED_ORIGINS` and the WebSocket origin check from `WEBSOCKET_ALLOWED_ORIGINS`, same format (comma-separated origins or `*`; local `*`, production the platform's origin); preflight answered, `Retry-After` exposed, no credentials. Formerly: no CORS on REST routes | Browser calls from another origin fail preflight. Dev: handled by the same-origin Vite proxy (`apps/web/vite.config.ts`). | no CORS code in `api/` |
| G2 | WS origin check | Dev origin must be in `WEBSOCKET_ALLOWED_ORIGINS` (e.g. `localhost:5173`) unless proxied keeping the Host header (what the Vite proxy does). | `api/internal/wsx/wsx.go:32-35`, `main.go:258` |
| G3 | RESOLVED for guests 2026-10-27 (uncommitted in the backend, `identity-v1` WORK-0057/0058): `POST /v1/guests` persists a distinct guest with its normalized display name and returns real credentials (JWT access token, refresh token); `lobby_update`, `session_started` and `roster_update` carry that name. Accounts sign in through a provider since the same day (WORK-0059): Google (WORK-0060, built; its check against the real Google deferred to Identity phase 2) and the fictitious local provider (`IDENTITY_LOCAL_PROVIDER=true`, only in development/local/test); the fixed test tokens no longer exist | `/sign-in` shows the providers `GET /v1/identity/login/providers` lists. | `identity/usecases/authorize/service.go`, `main.go#readIdentityVariables` |
| G4 | RESOLVED 2026-10-20: the join code is still released at Start, but every `lobby_update` and `session_started` now carries `session_uuid` | The frontend replaces `/join/:joinCode` with `/sessions/:sessionUUID/play` (ADR-0002) and reconnects by Session. | `api/play/live_connection.go`, `api/play/player_join.go`, `api/play/admin_join.go` |
| G5 | RESOLVED 2026-10-20, changed 2026-10-25 (uncommitted in the backend): the HTML and every asset of a version are signed together as one batch with one expiry, stored and shared by every Session of the version; a Session reuses the batch while it expires after the Session's own `expires_at` plus 5 min, otherwise a new 24 h batch is signed. So a URL a client gets always outlives its Session; there is no refresh endpoint. A failed signing at start fails the start; on reattach it keeps the start's access | The GameHost still caches by hash, so a reload or reconnect usually needs no download at all. | `play/session/usecases/frontendaccess/service.go:36`, `step_start_session.go:404`, `step_reattach_player.go:46` |
| G6 | Game frontend package is a single self-contained HTML file (Space Drift's seed version `...c2` holds the real one built here, `fixtures/games/space-drift`; `...c3` the one that loads assets); assets solved 2026-10-25 (ADR-0008: `play_game_version_assets`, image/audio/video, closed MIME list, 5/10/50 MiB per type, 100 MiB per version, sent in `frontend.assets`); no frontend fields in the manifest (entry, capabilities); manifest never sent to the client. Aspect ratio: solved 2026-10-20 outside the manifest (`play_game_versions.aspect_ratio`, sent as `frontend.viewport`) | Assets and the SDK contract need backend work. The game must know its own inputs/commands. | `play/session/internal/migrations/seed_objects.go`, `play/session/internal/business/manifest/manifest.go` |
| G7 | Signed GCS URL CORS: fake-gcs in dev answers `Access-Control-Allow-Origin: *` (checked 2026-10-20); a real bucket's CORS is unknown | The GameHost fetches the artifact and checks its hash (ADR-0005), so production needs bucket CORS for the web origin. | `play/session/internal/objectstore/gcs.go:119-136` |
| G8 | RESOLVED 2026-10-21 (uncommitted in the backend): a `leave` during a Start attempt waits for the attempt and is then applied (left the running game, or left the lobby if the start failed), answered `leave_result` `left` and closed 1000. `session_started`, a view and `roster_update` may arrive before `leave_result`; if the attempt aborted the Session, `session_ended` may come first | The feature ignores lobby, start and roster messages while leaving. | `play/runtime/workflows/liveconnection/step_leave_player.go` |
| G9 | No Game <-> Host bridge exists anywhere | Defined by this repository (it was out of the backend's scope): ADR-0005. | backend `docs/projects/active/session-runtime-v1/PROJECT.md:16` |

Backend doc drift seen (code wins): `api/README.md` shows paths without `/v1` and `/play/join`, says `lobby_closed` is sent "once the Session starts" and "Bearer <jwt>" (correct since 2026-10-27: access tokens are JWTs; clients still treat them as opaque); `play/CURRENT_STATE.md` mentions a non-existent `session_aborted`.

## 2. HTTP

Every route: observability -> authorization -> rate limit -> route (`api/server.go:47-103`). Error body: `{"code"?: string, "message": string}` (`api/internal/httpx/json.go:14-17`); branch on `code`.

### `POST /v1/guests` (no auth)

- Request `{"display_name": string (1..64 runes), "idempotency_key": UUID}`, body <= 4 KiB.
- `201` credentials body: `{"user":{"user_uuid","display_name","level"},"access_token","access_expires_at","access_expires_in","refresh_token"}`, `Cache-Control: no-store`; `access_expires_in` is the lifetime in seconds (the client measures expiry on its own clock from it); `level` `guest` | `account` (anything else: treat as guest); `display_name` is the backend's normalized form.
- The same key and name within 5 minutes answers the same guest (a retry); `400` invalid body/key/name (`invalid_display_name` when Identity rejects the name); `409` `idempotency_conflict` (key used with another name) or `idempotency_key_spent` (key older than 5 minutes: use a new one); `500`.

### `POST /v1/identity/refresh` (no auth)

- Request `{"refresh_token"}`. `200` credentials body: always a new access token (15 min); the refresh token is the same one unless the backend rotated it (after 5 h): keep the one returned. The previous refresh token keeps answering for 5 minutes after a rotation (with the current one), so two tabs racing a rotation both end with the same refresh token.
- `401` `refresh_invalid`: the credential is over (sign out). `503` / network: the credential may still be good (keep it, retry).

### `POST /v1/identity/logout` (no auth)

- Request `{"refresh_token"}`. `204` always (invalid or not); `503` on failure. Access tokens already issued stay valid until they expire.

### `GET /v1/identity/login/providers` (no auth)

- `200 {"providers":["google","local"]}`: the providers this backend offers (2026-10-31); cacheable 5 minutes. Unknown values may appear.

### `POST /v1/identity/login/start` (optional Bearer)

- Sent with the access token in use, if any (none is anonymous; one sent must be valid, else `401 token_invalid`, which the transport renews and retries). A guest's makes a new account theirs: same `user_uuid` and name, the guest's sessions ended (2026-10-29). An account that already exists is entered as before, the guest left behind.
- With `google`, `authorization_url` is Google's page (`accounts.google.com`), the callback registered in Google being the backend's `/v1/identity/login/google/callback` (through the Vite proxy in development).
- Request `{"provider": "local" | "google", "code_challenge": base64url(SHA-256(verifier)), no padding}`. `200 {"authorization_url"}`, a path of the backend's origin for the local provider: navigate the whole page there. `400` `provider_unavailable` (not enabled here) or `invalid_code_challenge`.

### `GET /v1/identity/login/{provider}/callback` (the provider's redirect)

- Always `302` to `WEB_SIGN_IN_COMPLETE_URL` (backend configuration; default `/sign-in/complete` on its own origin, which the Vite proxy makes ours): `?code=<one-time code, 60 s>` or `?error=cancelled|failed|unavailable`. The local provider's page (`GET /v1/identity/login/local/authorize?state`) offers Ana, Beto, Carla, any typed name, and Cancel; the same name is always the same account.

### `POST /v1/identity/login/complete` (no auth)

- Request `{"code", "code_verifier", "replaces_refresh_token"?}`. `200` credentials body (level `account`); the session of `replaces_refresh_token` is ended in the same transaction. `400` `login_code_invalid` (unknown, used, expired, or another verifier, which also uses the code up): start again.

### `PUT /v1/identity/me/display-name` (Bearer, `SET_OWN_DISPLAY_NAME`)

- Request `{"display_name"}` (1..64 runes). `200 {"user":{...}}` with the name as kept (trimmed); `400` / `400 invalid_display_name`. An account starts with `user.display_name` `""` until its person chooses one (2026-10-29); the access token keeps the old name until renewed, so renew right after (the lobby shows the name the access token carries).

### `GET /v1/identity/me` (Bearer, `VIEW_OWN_IDENTITY`)

- `200 {"user":{"user_uuid","display_name","level"}}`, from the access token. Not used by the frontend yet.

### `POST /v1/client-telemetry` (Bearer, `REPORT_CLIENT_TELEMETRY`, guests too)

- Body `{"events":[...]}`: at most 100 events, 16 KiB. `204` whatever the events held; `400` for a body that is not a batch or too many events. General per-user limits apply (5/s, 30/min).
- Closed catalog (`api/clienttelemetry/catalog.go`): `artifact_load {duration_ms, cached}`, `game_ready {duration_ms}`, `connection_lost {close, count?}`, `reconnect {outcome, count?}`, `resync {count?}`, `bridge_refusal {reason, count?}`, `error {origin, kind, count?}`; durations 0..600000 ms, counts 1..10000. Anything else is dropped and counted by the backend. Mirrored in `@playhoot/protocol` (`clientTelemetry.ts`). Recorded as `client_*` metrics, which today reach the backend's logs only (2026-10-21, ADR-0007).

### `POST /v1/sessions` (Bearer, `CREATE_SESSION`, accounts only)

- Request `{"game_uuid": UUID, "idempotency_key": string 1..128}`.
- `201 {"session_uuid", "join_code", "lobby_expires_at" (RFC3339)}`. Lobby TTL 30 min. Join code: 6 chars from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, case-insensitive.
- `404` game not playable; `409` key used for another request; `409 active_session_limit` the account already has as many active Sessions (open lobby or running) as it may have (default one), and that key keeps answering so: retry with a new key; `400`; `401`/`403`.
- The creator is not a player; to play they also open a player connection.

Seed games (non-production): `11111111-1111-4111-8111-111111111111` (input `move` vector2, 1-8 players); `22222222-...` (unavailable); `33333333-3333-4333-8333-333333333333` **Space Drift** (inputs `move` vector2, `boost` boolean; command `teleport{x,y}`; `update`, `playerRejoined`; 1-8 players); `55555555-5555-4555-8555-555555555555` **Tap Race** (the first SDK game, `fixtures/sdk-games/tap-race`; command `tap{}`; 1-8 players); `44444444-4444-4444-8444-444444444444` **Parqués** (no inputs; commands `roll{}` and `move{piece 0-3, die a|b|sum}`, answering `{ok, reason?, dice?}`; `update`, `playerRejoined`; 2-4 players; frontend `fixtures/games/parques`).

### Game authoring (`api/games`, Bearer, accounts only; game-creation-web-v1 B, 2026-11-02)

The source of truth is the backend's `api/README.md` ("The games route group"); this is what the frontend uses. Every answer is `Cache-Control: no-store`. A game that does not exist or is someone else's is `404` (never told apart); a game without a version being built is `409 not_editable`. Default request limits (5/s, 30/min per user per route) may answer `429 rate_limited` with `Retry-After`.

- `POST /v1/games` (`CREATE_GAME`) `{name, idempotency_key}` (name 1..80, the preliminary card name; 2026-11-02) -> `201 {game_uuid, version_uuid, revision}` (unpublished, private, revision 1 = the SDK starter template); `422 invalid_card`; `409 idempotency_conflict` (same key, another name).
- `GET /v1/games/{id}/draft[?revision=N][&content=true]` (`EDIT_GAME`) -> `{game_uuid, version_uuid, status, current_revision, revision, files[{path, sha256, size, content?}], assets[{key, type, description, optional, status missing|ready|undeclared, sha256?, size?, mime_type?, url? (15-min signed preview), url_expires_at?}], asset_diagnostics[], attempts[{kind change|restore|asset_upload|asset_removal, outcome, base_revision, revision?, origin, diagnostics[{path, code, message}], created_at}] (newest first), build, last_successful_build}`. `404 revision_not_found` past the current revision.
- `POST /v1/games/{id}/draft/changes` (`EDIT_GAME`) the envelope `{format: "playhoot.project-change.v1", base_revision, files[{path, content}], edits?[{path, find, replace, all?}], delete[], idempotency_key}` (<= 4 MiB; `edits` since 2026-11-05: find/replace of existing files applied in order on `base_revision`, `find` exactly once unless `all`; a path in one of files / edits / delete only) -> `200 {outcome applied|unchanged, revision, build: {status}, changes?: {since, revision, files[{path, sha256, size}], added[], modified[], deleted[]}, diffs?: [{path, diff, truncated?}]}` (`changes` since 2026-11-05, also on restores and asset answers, the web app ignores it; `diffs` the unified diff of each edited file, cut at 8 KiB, only on the first answer, never on a replay); `409 revision_conflict {current_revision}`; `422 invalid_change {diagnostics[{path, code, edit?, message}]}` (`edit` the edit's index from 0; codes `edit_not_found`, `edit_ambiguous`, `invalid_edit`); `409 idempotency_conflict`; `400` unknown format or missing fields.
- `GET /v1/games/{id}/draft/revisions[?before=N][&limit=L]` -> `[{number, source, files, created_at}]` newest first (2026-11-05), a page of at most 100 (`limit` 1..100, default 100) below `before` (from the current revision by default). Sources seen: `template`, `web`, `api`, `mcp`, `restore`, `asset`, `edition` (the list may grow).
- `GET /v1/games/{id}/draft/changed?since=N[&revision=M]` (2026-11-05) -> `{since, revision, files[{path, sha256, size}], added[], modified[], deleted[]}`: revision M's files (the current one by default) without contents and what changed since N (0: everything added); `404 revision_not_found`. `GET /v1/games/{id}/draft/files?path=a&path=b[&revision=M]` -> `{revision, files[{path, sha256, size, content}], missing[]}` (1..50 paths). Not used by the web app yet; they serve AIs.
- `POST /v1/games/{id}/draft/restore` `{revision, base_revision, idempotency_key}` -> answered like a change.
- `PUT /v1/games/{id}/draft/assets/{key}`: the raw file as the body, `Idempotency-Key` header -> `200 {outcome attached|unchanged, revision, asset}`; `413 asset_too_large {diagnostics}`; `422 invalid_asset {diagnostics}`; `404 asset_not_declared`; `503 uploads_busy` + `Retry-After`. Limits: image 5 MiB, audio 10 MiB, video 50 MiB, 100 MiB in all; the real type is read from the bytes.
- `POST /v1/games/{id}/draft/assets/{key}/remove` `{idempotency_key}` -> `200 {outcome removed|unchanged, revision}`.
- Builds: every new revision is built automatically. `build` / `last_successful_build` = `{revision, status QUEUED|RUNNING|SUCCEEDED|FAILED|SUPERSEDED (may grow), diagnostic_count (2026-11-05), diagnostics[{stage, code?, file?, line?, column?, message}], server?, client?, aspect_ratio?, reused, queued_at, started_at?, finished_at?}`; stage `infrastructure` is the platform failing, never the game. `GET /v1/games/{id}/draft/build?revision=N&wait=S` (S 0..20) answers when the build ended or after S seconds; `404 build_not_found`.

- Simulations (game-creation-web-v1 H, 2026-11-02; built against this contract while the backend builds it): `POST /v1/games/{id}/draft/simulations` (`EDIT_GAME`), body = the scenario as the person pasted it (`{format: "playhoot.scenario.v1", ...}`, sent as is) -> `200` the result `{format: "playhoot.simulation-result.v1", revision, finished, stopped?, observations, final, commands, rejected, events, errors, script_error?, ...}`, kept whole (unknown fields too) so the person can copy it back to their AI; nothing is stored. Runs against the build of the current revision: `409 build_not_ready` (with the build's status) when it has not succeeded; `422 invalid_scenario {diagnostics[{path?, code, message}]}`; `503 simulations_busy` + `Retry-After`; `404` not found or not the owner.

- Previews (game-creation-web-v1 D, 2026-11-02; built against this contract while the backend builds it): `POST /v1/games/{id}/draft/previews` (`EDIT_GAME`) `{revision?, players}` -> `201 {preview_uuid, revision, participants[]}`: a private test game of that revision's succeeded build (the current one by default) with `players` synthetic participants; opening one ends the game's previous preview. `409 build_not_ready` (with the build's status); `422 invalid_players {min, max}`; `422 preview_script_failure` (the game's start failed in its script: the section points to Escenarios to see why); `503 preview_unavailable`; `400` malformed body or `players` < 1 (a client bug); `404` not found or not the owner. Then the creator connects to `GET /v1/play/previews/{preview_uuid}/connect` with the same token subprotocol as the player and admin connections. Server -> client: `preview_started {preview_uuid, revision, participants, acting_as, paused, frontend}` (the frontend as in `session_started`) then a FULL `player_view`; `player_view` as the player connection's (patches, revisions, ack) for the participant acted as only; `acting_as {participant_id}` then that participant's FULL view; `paused`; `resumed`; `command_result {token, outcome, response?}`; `error {code, detail?, token?}`, the connection staying open: `invalid_game_data` for a SAMPLE or COMMAND the game does not declare (the command with that `token` is answered `invalid`; shown to the creator as a game problem), `unknown_participant` answering an `act_as` (the current participant stays); `command_result` outcome `paused` while paused; `preview_ended {reason: finished|idle|ended_by_owner|replaced|script_failure|unavailable}` then close 1000 (`idle` also after the 4 h lifetime; `unavailable` when no instance runs it any more, e.g. after a restart; reasons may grow); `rejected {reason}` (`not_found` + 1008 for anyone but the owner). Client -> server: `act_as {participant_id}` (sample sequences start again at 1), `sample {sequence, inputs}`, `command {token, name, payload?}`, `resync`, `pause`, `resume`, `end`. A view of a participant no longer acted as is stale and dropped; the game of each participant is a new GameHost run, so one participant's local UI never shows for another.

- AI link (game-creation-web-v1 F, 2026-11-02; built against this contract while the backend builds it): `POST /v1/games/{id}/ai-link` (`EDIT_GAME`) -> `201 {url, expires_at}`: creates the game's link for the creator's AI, valid 7 days, replacing the active one (which stops working). `url` holds the secret token and is answered ONLY here: the frontend shows it once and keeps it in memory only, never in storage nor in the page URL. `GET /v1/games/{id}/ai-link` -> `{active, created_at?, expires_at?}` (no secret). `POST /v1/games/{id}/ai-link/revoke` -> `204`. Errors as above (`404` not found or not the owner).

The AI-facing surface behind that `url` (`/ai/v1/{token}...`, served by the backend for the creator's AI, not used by this frontend): a Markdown context page (`?format=json` for agents) with the game's current revision, `notes.md`, build status and diagnostics, assets, latest attempts and how to send a change; the sources inline when the project is small, else one link per file pinned to the revision shown; `POST .../changes` and `PUT .../assets/{key}` take the same envelope and files as above, recorded with origin `api`. The token is the credential, so those requests carry no `Authorization`. The section labels the page names ("Cambios de mi IA", "Recursos", ...) are this frontend's.

CORS: the preflight allows `Authorization, Content-Type, Idempotency-Key` (resolved 2026-11-02 in the backend, `api/internal/cors`), so the asset upload works cross-origin too.

#### Card and publishing (game-creation-web-v1 E, 2026-11-02)

Game Management's card and the publication (backend `api/README.md`, games group). Owner only; anyone else is `404`.

- `GET /v1/games/{id}` -> `{game_uuid, name, description, logo {uuid, mime_type, size, url, url_expires_at}|null, photos[same], visibility, published, published_at?, editing, publishing, live {release_sequence, revision, version_uuid, published_at}|null}`; `live` is the publication players get (the latest completed release, null before the first), shown as "Versión publicada: revisión N (publicación #S)"; image URLs are signed reads valid 15 minutes. `editing` false with `published` true means no edition is open: the draft routes answer `409 not_editable`, and the workspace shows the published state.
- `PATCH /v1/games/{id}` `{name?, description?}` -> `200 {outcome done|unchanged}`; `422 invalid_card` (name 1..80, description <= 2000).
- `PUT /v1/games/{id}/logo`, `POST /v1/games/{id}/photos`: raw image body, `Idempotency-Key` header; PNG, JPEG or WebP by their bytes; logo <= 2 MiB, photo <= 5 MiB, at most 8 photos -> `200 {outcome, image}`; `413 image_too_large`; `422 invalid_card`; `409 too_many_photos` / `idempotency_conflict`. `POST .../logo/remove`, `POST .../photos/{photoID}/remove` -> `200`; `404 image_not_found`.
- `POST /v1/games/{id}/publish` `{visibility public|private, name?, idempotency_key}` publishes the CURRENT revision of the open edition (a `name` replaces the card name first) -> `200 {outcome published, release_uuid, sequence, version_uuid, revision, visibility}`; `409 not_ready {blockers[{code, build_status?, keys?}]}` with codes `build_not_succeeded`, `build_not_for_current_revision`, `missing_required_assets` (keys), `invalid_name`, `name_required`, `revision_changed` (the list may grow: an unknown one is shown with its code); `409 not_editable`; `409 idempotency_conflict`. The same key answers the same release.
- `POST /v1/games/{id}/editions` `{idempotency_key}` -> `201 {version_uuid, revision}` (revision 1 copies the published sources and assets); `409 not_published` / `edition_open` / `publishing`.
- `POST /v1/sessions` checks playability for real (published, not deleted, public or the caller's own; otherwise `404`). The host's "Create Session" takes `?game=<uuid>` (a published game's own link), the default seed game otherwise.
- `GET /v1/games` -> `200 [{game_uuid, name, published, visibility, editing, publishing, updated_at}]`, the caller's own games newest first ("Mis juegos", `/games`). `visibility` may grow beyond `public`/`private`.

### AI apps through MCP (game-creation-web-v1 I, 2026-11-03)

The backend is an MCP server and the OAuth authorization server of AI apps (Claude, ChatGPT...): an app connects to the account (not to one game), and its tools are the same operations as the AI link's, with origin `mcp`; it can create games, never publish nor read the profile. The web only takes part in the consent and in listing connections; tokens are exchanged between the backend and the AI app and never reach the web.

- The backend's authorization endpoint sends the person to the web's `/connect-ai?request=<id>` (account only; sign-in first with return to it).
- `GET /v1/ai-authorizations/{requestID}` (Bearer) -> `200 {client_name, client_uri?, redirect_host, scopes[] ("games"; may grow), expires_at}`; `404` unknown, expired or already decided.
- `POST /v1/ai-authorizations/{requestID}/approve` and `.../deny` (Bearer) -> `200 {redirect_url}`; the web navigates the whole browser there (the AI app's callback, with the code or the denial). `404` as above.
- `GET /v1/ai-connections` (Bearer) -> `200 [{connection_id, client_name, created_at, last_used_at?}]` ("IAs conectadas", `/account/ai-connections`); `POST /v1/ai-connections/{connectionID}/revoke` -> `204` (the app stops at its next request).

### Auth (`api/internal/auth/auth.go`)

| Status | `code` |
| --- | --- |
| 401 (+`WWW-Authenticate: Bearer`) | `token_required` |
| 401 | `token_malformed`, `token_invalid` |
| 403 | `operation_forbidden` (guest creating a session or joining as admin) |

- REST: `Authorization: Bearer <token>`.
- WebSocket from a browser: subprotocols `["playhoot.v1", "base64url.bearer.authorization.playhoot." + base64url_unpadded(token)]`. The server selects only `playhoot.v1`.
- Operations: `CREATE_SESSION`, `JOIN_SESSION_AS_ADMIN` (accounts); `JOIN_SESSION_AS_PLAYER`, `REPORT_CLIENT_TELEMETRY`, `VIEW_OWN_IDENTITY` (guests allowed).
- Operation catalog (2026-10-27, backend IDENTITY-ADR-0003, uncommitted in the backend): `GET /v1/identity/operations`, no token, `200 {"operations":[{"operation":"CREATE_SESSION","required_level":"account"},...]}`, ordered by operation, `Cache-Control: public, max-age=300`. Levels on `anonymous < guest < account`; the catalog is the one `Authorize` decides with. Unknown operations or levels may appear (`backend-contract-values.md`). The caller's own level comes in every credentials body (`user.level`) and from `me`; accounts are level `account`.

## 3. WebSocket routes

| Route | Role |
| --- | --- |
| `GET /v1/play/join/{joinCode}` | player (code resolved first) |
| `GET /v1/play/join/sessions/{sessionUUID}/player` | player |
| `GET /v1/play/join/sessions/{sessionUUID}/admin` | admin (creator only) |

Pre-upgrade failures are HTTP responses the browser `WebSocket` cannot read (it sees an error / close 1006): auth 401/403; join code lookup failure 500; (since 2026-10-25 the live join endpoints refuse limits readably after the upgrade: `rejected` `rate_limited` with `retry_after_seconds`, `too_many_connections`, `server_busy`; pre-upgrade 429/503 only under a flood that leaves no room to refuse readably; REST keeps HTTP 429/503); session routing failure 500 or owned elsewhere 503 (since 2026-10-25 an unknown, malformed or ended Session is no longer refused here: see Admission); formerly session 400/404 (only LOBBY-before-expiry or RUNNING is joinable)/503; 429 `too_many_connections` (10 per user per instance); 503 `server_busy`; 400 missing `playhoot.v1`; origin mismatch.

Framing: text frames, JSON object with `type`. Max 32 KiB per message.

### Close codes

| Code | Meaning |
| --- | --- |
| 1000 | Runtime end; reason `session_ended`, `disconnected`, `left` or `replaced` (`replaced` = do not reconnect) |
| 1001 | Server shutting down |
| 1003 | Binary frame |
| 1007 | Invalid JSON / missing type / malformed sample, command or select (reason `malformed message`). Reason `invalid_game_data` (2026-10-25, uncommitted in the backend): the game's data does not match its declaration, an invalid SAMPLE or a COMMAND undeclared or with a payload not matching it; recorded in `play_game_faults` (SERVER, `INVALID_SAMPLE` / `INVALID_COMMAND`) before closing; nothing is sent before the close; only that connection ends |
| 1008 | Unknown type for this endpoint, rate limited, or admission rejected |
| 1009 | Message too big |
| 1011 | Server failure (also: recovery failed — retry) |
| 1012 | `owner_changed` — reconnect |
| (1006) | Dropped: slow consumer or no pong (ping every 15 s, 10 s to answer) |

### Admission

Upgrade first, then the Runtime admits or sends `{"type":"rejected","reason"}` + close 1008. Both player endpoints take `?device=desktop|mobile` (2026-10-25, required: missing or unknown is an unsupported device); every player attach checks it against the version's input requirements, and a refusal is `{"type":"rejected","reason":"device_not_supported","requirements":{"devices":"desktop|mobile|both","uses_keyboard","uses_pointer_hover","uses_pointer_press"}}`; a refused device never replaces the player's current connection. Admins take no device. By Session UUID (player and admin, 2026-10-25, uncommitted in the backend): an unknown or malformed UUID is `invalid_session`; a Session in a terminal state is `{"type":"rejected","reason":"session_ended","status","end_cause"}`; a lobby past its expiry not yet ended by reconciliation (at most 5 min) is `session_unavailable`. The Session's availability is checked before the device; the device is checked before the lobby's capacity and before asking the game about a rejoin. Joining by code (2026-10-21, uncommitted in the backend), the code is resolved by its newest assignment and its Session's status, and a refused code is sent the same way, without the Session UUID: `invalid_join_code` (no such code, malformed, or its Session ended), `join_code_expired` (the lobby still runs, the code expired), `session_started` (the Session left the lobby and has not ended). Reasons: `session_unavailable`, `not_creator`, `session_started` (non-participant of a running game), `lobby_full`, `participant_disconnected` (game without `playerRejoined`), `rejoin_rejected`, `owner_changed`, `too_many_admins` (> 8), `server_busy`. While a rejoin waits for the game, the socket receives nothing until `session_started` or `rejected`.

### Player -> server

| type | fields | notes |
| --- | --- | --- |
| `sample` | `sequence` int > 0, `inputs` object | Full snapshot of logical inputs; omitted inputs take defaults. Never answered; acknowledged in views. Stale sequence ignored. Undeclared input / invalid value -> recorded, then close 1007 `invalid_game_data`. **Each new connection restarts sequences at 1.** Dropped before the game runs. |
| `command` | `token` string 1..128, `name`, `payload?` object/null | Answered by `command_result`. Undeclared name or payload not matching its declaration -> recorded, then close 1007 `invalid_game_data`, unanswered. |
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

- `lobby_update` `{session_uuid, members: [{user_uuid, display_name}], min_players, max_players}` — whole lobby, join order; `min_players` / `max_players` are the game version's player limits (2026-10-27, Z13; players get them too). Admin's first message. None after start.
- `session_started` — player: `{session_uuid, participant_id, participants: [{participant_id, user_uuid, display_name}], frontend: {url, sha256, expires_at, viewport: {aspect_ratio, width, height}, assets: [{key, type, mime_type, sha256, size, url}]}}`; admin: same without `participant_id`. `assets` lists every asset of the version that has a stored object (`[]` when none); `url`, `expires_at` and the asset URLs come from one signed batch (`expires_at`, whole seconds, is shared; a URL works until it and stops within a second after). `viewport` is the game version's fixed shape: `aspect_ratio` from a closed backend catalog (`16:9`, `9:16`, `4:3`, `3:4`, `1:1`; a game picks one, it cannot declare its own) and its logical resolution (1080 on the short side: 1920x1080, 1080x1920, 1440x1080, 1080x1440, 1080x1080), the size the game draws in and receives input in (`play/session/internal/business/gameversion/aspect_ratio.go`, `api/play/live_connection.go`). Participants `P1..Pn` in lobby order. Re-sent on every reattach/rejoin, followed by a FULL view.
- `player_view` (player) `{participant_id, full, revision, state, consumed_through_sample_sequence, errors?, events?}`.
- `player_view` (admin) `{participant_id, full, revision, state, events?}` — no ack, no errors.
- `command_result` `{token, outcome, response?}` — `executed` (response is the game's JSON, may be a game-rule rejection), `already_processed` (no response kept), `invalid` (no longer sent since 2026-10-25: invalid commands close the connection), `session_not_running`, `rate_limited` (token unused, may retry).
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

Manual flow: `node scripts/dev-host.mjs` signs in through the local provider, creates a Session of Space Drift and connects as its admin (Enter sends `start_session`); players connect to `/v1/play/join/{code}` with a guest's access token from `POST /v1/guests`.
