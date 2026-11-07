// PSEUDOCODE — Go syntax, not compiled.
// EXTERNAL: every call the frontend makes to the backend, as bare functions (inputs -> DTO).
// Every call goes to the same origin as the page (in development the Vite proxy forwards
// /v1 to the backend). Contract details: docs/architecture/BACKEND_CONTRACT.md.
package mirror

// ─── HTTP ──────────────────────────────────────────────────────────────────

// ListOperations reads every operation with the minimum authentication level it requires. No
// credential. Public and cacheable (5 minutes).
// endpoint: GET /v1/identity/operations
// answer: 200 {"operations":[{"operation":"CREATE_SESSION","required_level":"account"},...]}
// code: packages/communication/src/identityClient.ts#listOperations
func ListOperations() (map[string]string, *HttpFailure) { return nil, nil }

// CreateSession creates a Session of a game as the signed-in account.
// endpoint: POST /v1/sessions {game_uuid, idempotency_key} (Bearer)
// answer: 201 {session_uuid, join_code, lobby_expires_at}; 404 when the game is not playable
// code: packages/communication/src/sessionsClient.ts#createSession
func CreateSession(gameUUID, idempotencyKey string) (struct{ SessionUUID, JoinCode string }, *HttpFailure) {
	return struct{ SessionUUID, JoinCode string }{}, nil
}

// OpenAdminConnection opens the creator's admin connection to their Session (token in the
// subprotocol, like a player's). Server messages: lobby_update (with min_players, max_players),
// session_started (without the creator's participant), player_view of the watched participant (no
// ack, no errors), start/cancel/select_perspective results, session_ended / lobby_closed, rejected.
// endpoint: WebSocket /v1/play/join/sessions/{sessionUUID}/admin
// code: packages/communication/src/adminConnection.ts
func OpenAdminConnection(sessionUUID string) (Socket, *NoCredential) { return Socket{}, nil }

// CreateGuest creates a guest identity for someone without an account. A retry with the same key
// (within 5 minutes) answers the same guest.
//
//	POST /v1/guests   (no Authorization header)
//	body: {"display_name": displayName, "idempotency_key": idempotencyKey}
//
// code: packages/communication/src/identityClient.ts#createGuest
func CreateGuest(displayName string, idempotencyKey string) (Credential, *HttpFailure) {
	// 201 -> Credentials body (see RefreshCredentials) -> Credential
	// 400 -> HttpFailure{Status: 400, Code: "invalid_display_name" | ""}   (name rejected)
	// 409 -> HttpFailure{Code: "idempotency_conflict" | "idempotency_key_spent"}
	// 429 -> HttpFailure{Code: "rate_limited", RetryAfterSeconds}
	// network down / anything else -> HttpFailure{Kind: "network" | "http"}
	return Credential{}, nil
}

// RefreshCredentials renews the access token with the refresh token alone.
//
//	POST /v1/identity/refresh   (no Authorization header)
//	body: {"refresh_token": refreshToken}
//
// Credentials body (also of CreateGuest): {"user":{"user_uuid","display_name","level"},
// "access_token","access_expires_at","access_expires_in","refresh_token"}; level "account" -> Kind
// "account", anything else -> "guest"; ExpiresAt = now (this device) + access_expires_in. The refresh token returned may be a new one: always keep the one returned.
// code: packages/communication/src/identityClient.ts#refresh
func RefreshCredentials(refreshToken string) (Credential, *HttpFailure) {
	// 200 -> Credential
	// 401 -> HttpFailure{Code: "refresh_invalid"}   (the credential is over)
	// 503 / network / anything else -> the credential may still be good
	return Credential{}, nil
}

// ListLoginProviders reads the login providers the backend offers. No credential.
// endpoint: GET /v1/identity/login/providers -> 200 {"providers":["google","local"]}
// code: packages/communication/src/identityClient.ts#listLoginProviders
func ListLoginProviders() ([]string, *HttpFailure) { return nil, nil }

// StartLogin starts an account sign-in; answers where to send the whole page.
// endpoint: POST /v1/identity/login/start {"provider", "code_challenge"} (no Authorization)
// answer: 200 {"authorization_url"}; 400 provider_unavailable | invalid_code_challenge;
//         429 rate_limited
// code: packages/communication/src/identityClient.ts#startLogin
func StartLogin(provider, codeChallenge string) (string, *HttpFailure) { return "", nil }

// CompleteLogin exchanges the one-time code and the verifier for the account's credentials; the
// session of `replaces` (the guest in use) ends with it.
// endpoint: POST /v1/identity/login/complete {"code", "code_verifier", "replaces_refresh_token"?}
// answer: 200 credentials body (level "account"); 400 login_code_invalid (start again)
// code: packages/communication/src/identityClient.ts#completeLogin
func CompleteLogin(code, verifier, replaces string) (Credential, *HttpFailure) {
	return Credential{}, nil
}

// Logout ends the refresh token's session on the backend. Answer ignored.
// endpoint: POST /v1/identity/logout {"refresh_token"} -> 204
// code: packages/communication/src/identityClient.ts#logout
func Logout(refreshToken string) {}

// Every HTTP call goes through one client that:
//   - attaches "Authorization: Bearer <token>" from the global credential when the call needs it;
//   - never throws: it returns a value or an HttpFailure;
//   - when the backend answers 401 with code "token_invalid" to a call that carried a token,
//     renews it once with Refresh() in state_app.go and sends the call again; if the backend
//     refused the renewal the credential is dead and SignOut() runs; if it could not be reached,
//     the 401 is returned and the credential kept.
//
// code: packages/communication/src/http.ts#createHttpClient
type HttpFailure struct {
	Kind              string // "network" (no answer) | "http" (error status) | "decode" (body breaks the contract)
	Status            int
	Code              string // backend's stable reason when present: token_required, token_invalid, rate_limited...
	RetryAfterSeconds int
}

// SendClientTelemetry sends a batch of the client's telemetry (ADR-0007). Never answered with data.
//
//	POST /v1/client-telemetry   (Authorization: Bearer <token>; keepalive when the page is going away)
//	body: {"events": [ ... at most 100 ... ]}
//
// rule: sent at most every 30 s, sooner when 50 events wait, and once more when the tab is hidden
//       or the page goes away; only once there is a credential (events wait until then, at most 100).
// rule: counted events of the same kind and values are merged into one with a "count".
// rule: a batch that fails is dropped, never retried.
// code: packages/communication/src/telemetryReporter.ts#createTelemetryReporter
func SendClientTelemetry(events []TelemetryEvent) {
	// 204 -> nothing. 400 (not a batch) / network error -> dropped.
}

// TelemetryEvent is one event of the backend's closed catalog (BACKEND_CONTRACT.md). Which feature
// event becomes which telemetry event, and which origin each error has, is decided in one place:
// apps/web/src/telemetry/classify.ts.
//
//	artifact_load {duration_ms, cached}   <- Session Play: the game's frontend was loaded
//	game_ready {duration_ms}              <- Session Play: the game answered READY
//	connection_lost {close}               <- Join: any live connection closed (how it closed)
//	reconnect {outcome}                   <- Join: a reconnection opened (reconnected) or the last failed (gave_up)
//	resync                                <- the connection asked for a FULL view after missing one
//	bridge_refusal {reason}               <- the GameHost refused a game message (invalid / over_limit)
//	error {origin, kind}:
//	  transport:          unreachable, connection_lost, protocol_error (join outcomes), network (guest creation)
//	  backend_rejection:  the rejection reason of a join, rejected_unknown, rate_limited (guest creation)
//	  artifact:           artifact_unreachable, artifact_hash_mismatch, ready_timeout, unsupported_bridge_version
//	  bridge:             bridge_abuse, container_violation
//	  presentation:       render_failed (the route error boundary caught a crash)
//	Not errors: a Session that ended, leaving, being replaced, a name typed wrong.
type TelemetryEvent struct {
	Name   string
	Fields map[string]any
}

// ─── Storage (not the backend API) ──────────────────────────────────────────

// FetchGameArtifact downloads a game's frontend artifact (one HTML file today).
//
//	GET <session_started.frontend.url>   (a signed storage URL, shared by every Session of the
//	                                    version and outliving this Session; no cookies sent)
//
// Only called when the browser's artifact cache has nothing for that SHA-256. The answer is
// accepted only if its SHA-256 equals session_started.frontend.sha256. Needs CORS on the bucket
// (fake-gcs in development allows any origin).
//
// code: packages/game-host/src/artifact.ts#createArtifactLoader
func FetchGameArtifact(signedURL string) ([]byte, *HttpFailure) {
	return nil, nil
}

// FetchGameAsset downloads one game asset (image, audio or video; ADR-0008).
//
//	GET <session_started.frontend.assets[i].url>   (signed in one batch with the artifact; the
//	                                                backend makes it outlive the Session; no cookies)
//
// Only called when the game asks for a declared asset and the browser's asset cache has nothing
// for its SHA-256 (one download per hash at a time). Accepted only if its size and SHA-256 equal
// the listed ones; anything else answers the game "no such asset" and the next request tries again.
//
// code: packages/game-host/src/assets.ts#createAssetLoader
func FetchGameAsset(signedURL string) ([]byte, *HttpFailure) {
	return nil, nil
}

// ─── WebSocket (one live connection per player per Session) ────────────────

// OpenPlayerConnection opens the realtime connection. Opening it IS joining.
//
//	by code:    GET ws(s)://<origin>/v1/play/join/{joinCode}?device=<desktop|mobile>
//	by Session: GET ws(s)://<origin>/v1/play/join/sessions/{sessionUUID}/player?device=<desktop|mobile>
//	device: the device's class at that moment (DeviceCapabilities.deviceClass), on every connection;
//	        a game the device cannot play -> "rejected" device_not_supported with the game's requirements
//	subprotocols: "playhoot.v1", "base64url.bearer.authorization.playhoot.<base64url(token)>"
//
// Returns NoCredential without opening anything when there is no token.
// A refused join code opens and then gets "rejected" with its reason: invalid_join_code (no such
// code, or its Session ended), join_code_expired (the lobby still runs, the code expired) or
// session_started. If the backend refuses the handshake itself (auth, rate limit, busy), the
// browser only sees a close before "open": the reason is invisible (BACKEND_CONTRACT Z10).
//
// code: packages/communication/src/sessionConnection.ts#createSessionConnector
func OpenPlayerConnection(target SessionTarget) (Socket, *NoCredential) {
	return Socket{}, nil
}

type SessionTarget struct {
	Kind        string // "joinCode" | "session"
	JoinCode    string
	SessionUUID string
}

type NoCredential struct{}

// Client -> server messages (JSON text frames).
func SendSample(s Socket, sequence int, inputs map[string]any)         {} // {"type":"sample","sequence","inputs"}
func SendCommand(s Socket, token, name string, payload map[string]any) {} // {"type":"command","token","name","payload"}
func SendResync(s Socket)                                              {} // {"type":"resync"}
func SendLeave(s Socket)                                               {} // {"type":"leave"}
// SendGameFault tells the backend the game frontend failed or misbehaved and was stopped; the
// backend stores it for auditing (one record per Session, player and kind) and never answers.
// kind: artifact_unreachable | artifact_hash_mismatch | ready_timeout | unsupported_bridge_version
//       | container_violation | bridge_abuse. rule: a detail over 2 KiB is sent as {"truncated": true}.
// code: packages/communication/src/sessionConnection.ts#reportGameFault
func SendGameFault(s Socket, kind string, detail map[string]any) {} // {"type":"game_fault","kind","detail"}
func CloseSocket(s Socket)                                       {} // client closes (code 1000), no leave

// Server -> client messages, as DTOs. The connection validates each one; an unknown type is
// ignored, a known type with a broken shape is a protocol error.
type LobbyUpdate struct { // "lobby_update": the whole lobby, every time it changes
	SessionUUID string
	Members     []struct{ UserUUID, DisplayName string } // in join order; DisplayName from the backend's Identity ("" if none)
}

type SessionStarted struct { // "session_started": also re-sent on every reattach/rejoin, with Frontend signed again then
	SessionUUID   string
	ParticipantID string // "P1".."Pn", this player
	Participants  []struct{ ParticipantID, UserUUID, DisplayName string }
	Frontend      struct { // the game's frontend artifact (signed URL)
		URL, SHA256, ExpiresAt string
		Viewport               Viewport
	}
}

// Viewport is the game's fixed shape: an aspect ratio from the backend's catalog ("16:9", "9:16",
// "4:3", "3:4", "1:1"; a game picks one) and its logical size, 1080 on the short side
// (1920x1080, 1080x1920, 1440x1080, 1080x1440, 1080x1080).
// rule: session_started without a viewport, or with a width/height that is not a positive whole
//       number, is not understood (like any malformed message).
type Viewport struct {
	AspectRatio   string
	Width, Height int
}

type RosterUpdate struct { // "roster_update": after session_started, and whenever someone's presence changes
	Members []struct {
		ParticipantID, UserUUID, DisplayName string
		Status                               string // "active" | "reconnecting" | "disconnected" | "left"
	}
}

type PlayerView struct { // "player_view": this player's state
	Full                          bool // true: State replaces everything; false: State is a patch
	Revision                      int  // per connection: FULL and patch = last+1, ack-only = last
	State                         any
	ConsumedThroughSampleSequence int   // ack of our samples
	Errors, Events                []any // transient: delivered once
}

type CommandResultMsg struct { // "command_result"
	Token    string
	Outcome  string // executed | already_processed | invalid | session_not_running | rate_limited
	Response any    // the game's own answer when executed
}

type Rejected struct{ Reason string }             // "rejected": admission refused, then close
type SessionEnd struct{ Status, EndCause string } // "session_ended" | "lobby_closed"
type LeaveResult struct{ Outcome string }         // "leave_result"

type Socket struct{}

// ─── Game authoring (REST, accounts) ────────────────────────────────────────
// Every answer is no-store. 404: no such game, or not yours (never told apart). 409 not_editable:
// the game has no version being built. code: packages/communication/src/gamesClient.ts

// CreateGame creates an unpublished game whose draft starts at revision 1 (the SDK template).
// endpoint: POST /v1/games {idempotency_key} -> 201 {game_uuid, version_uuid, revision}
func CreateGame(name string, idempotencyKey string) (struct{ GameUUID string }, *GamesFailure) {
	return struct{ GameUUID string }{}, nil
}

// ReadDraft reads one revision of the draft (the current one by default), with its files' text.
// endpoint: GET /v1/games/{id}/draft?content=true[&revision=N]
// answer: files, assets (missing/ready/undeclared, preview url), attempts (newest first, with
// diagnostics), build and last_successful_build
func ReadDraft(gameUUID string) (Draft, *GamesFailure) { return Draft{}, nil }

// ApplyChange sends the change envelope on its base revision, all or nothing.
// endpoint: POST /v1/games/{id}/draft/changes {format "playhoot.project-change.v1", base_revision,
// files[{path, content}], edits?[{path, find, replace, all?}] (only when the change has any),
// delete[], idempotency_key}
// answer: 200 {outcome applied|unchanged, revision, build{status}, diffs?[{path, diff, truncated?}]};
// 409 revision_conflict {current_revision}; 422 invalid_change {diagnostics[{path, code, edit?,
// message}]}; 409 idempotency_conflict
func ApplyChange(gameUUID string, change DraftChange, idempotencyKey string) (ChangeResult, *GamesFailure) {
	return ChangeResult{}, nil
}

// RestoreRevision makes an earlier revision's files and assets the newest revision.
// endpoint: POST /v1/games/{id}/draft/restore {revision, base_revision, idempotency_key}
func RestoreRevision(gameUUID string, revision, baseRevision int, idempotencyKey string) (ChangeResult, *GamesFailure) {
	return ChangeResult{}, nil
}

// ListRevisions lists a page of revisions, newest first: at most 100, below `before` when given
// (from the current one otherwise).
// endpoint: GET /v1/games/{id}/draft/revisions[?before=N] -> [{number, kind, origin?, actor,
// parent?, restored_from?, from?{game_uuid, version_uuid, revision?}, sdk, files, created_at}]
func ListRevisions(gameUUID string, before *int) ([]Revision, *GamesFailure) { return nil, nil }

// DiffRevisions compares revision `from` (0: the empty project) with `to` (the current one when
// nil), only `path` when given.
// endpoint: GET /v1/games/{id}/draft/diff?from=N[&to=M][&path=P] -> {from, to, files[{path,
// status added|modified|deleted, diff?, truncated?, omitted?}]}; 404 revision_not_found
func DiffRevisions(gameUUID string, from int, to *int, path *string) (RevisionDiff, *GamesFailure) {
	return RevisionDiff{}, nil
}

// UploadAsset sends a declared asset's file as the raw body.
// endpoint: PUT /v1/games/{id}/draft/assets/{key} (header Idempotency-Key)
// answer: 200 {outcome attached|unchanged, revision, asset}; 413 asset_too_large; 422 invalid_asset
// {diagnostics}; 404 asset_not_declared; 503 uploads_busy + Retry-After
func UploadAsset(gameUUID, key string, file File, idempotencyKey string) (ChangeResult, *GamesFailure) {
	return ChangeResult{}, nil
}

// RemoveAsset unbinds an asset in a new revision.
// endpoint: POST /v1/games/{id}/draft/assets/{key}/remove {idempotency_key} -> {outcome removed|unchanged, revision}
func RemoveAsset(gameUUID, key, idempotencyKey string) (ChangeResult, *GamesFailure) {
	return ChangeResult{}, nil
}

// ReadBuild reads one revision's build, waiting up to waitSeconds (at most 20) for it to end.
// endpoint: GET /v1/games/{id}/draft/build?revision=N&wait=S -> {revision, status, diagnostics, ...}
func ReadBuild(gameUUID string, revision, waitSeconds int) (Build, *GamesFailure) {
	return Build{}, nil
}

// CreateAiLink makes the game's link for the creator's AI (7 days), replacing the active one.
// endpoint: POST /v1/games/{id}/ai-link -> 201 {url, expires_at}; url holds the secret, answered only here
func CreateAiLink(gameUUID string) (AiLink, *GamesFailure) { return AiLink{}, nil }

// ReadAiLink tells whether the game has an active link, without its secret.
// endpoint: GET /v1/games/{id}/ai-link -> {active, created_at?, expires_at?}
func ReadAiLink(gameUUID string) (AiLinkStatus, *GamesFailure) { return AiLinkStatus{}, nil }

// RevokeAiLink ends the active link at once.
// endpoint: POST /v1/games/{id}/ai-link/revoke -> 204
func RevokeAiLink(gameUUID string) *GamesFailure { return nil }

// CreatePreview opens a private test game of a revision's succeeded build (the current one by
// default) with `players` synthetic participants; opening one ends the game's previous preview.
// endpoint: POST /v1/games/{id}/draft/previews {revision?, players} ->
// 201 {preview_uuid, revision, participants}; 409 build_not_ready; 422 invalid_players {min, max};
// 503 preview_unavailable
func CreatePreview(gameUUID string, players int) (string, *GamesFailure) { return "", nil }

// PreviewConnect is the creator's live connection to a preview.
// endpoint: WebSocket /v1/play/previews/{id}/connect (token subprotocol). In: preview_started,
// player_view (the participant acted as), acting_as, paused, resumed, command_result,
// preview_ended {reason}, rejected. Out: act_as, sample, command, resync, pause, resume, end.
func PreviewConnect(previewUUID string) {}

// RunSimulation plays a scenario (as pasted), or {scenario_path} / {all: true} for the saved ones,
// on the build of the current revision. The backend keeps each result 30 minutes.
// endpoint: POST /v1/games/{id}/draft/simulations -> {format: playhoot.simulation-summary.v1,
// result_id, revision, toolchain_version?, players, passed?, expectations?{total, passed, failed[]},
// finished, stopped, observed_at_ms, counts, rejected[<=10], errors[<=10], script_error?} | the
// whole playhoot.simulation-result.v1 (detail full) | {format: playhoot.simulation-batch.v1,
// passed?, scenarios[{path, summary | diagnostics}], skipped} (all)
func RunSimulation(gameUUID string, request any) (SimulationAnswer, *GamesFailure) {
	return SimulationAnswer{}, nil
}

// CreateGame creates a game for the account: from the starter project, or from a template.
// endpoint: POST /v1/games {name, idempotency_key, template_game_uuid?} -> 201 {game_uuid,
// version_uuid, revision}; 404 template_not_found
//
// Templates (any account): BrowseTemplates GET /v1/templates -> {featured[entry], categories};
// SearchTemplates GET /v1/templates/search?q&category&players&page -> {page, templates, more};
// InspectTemplate GET /v1/templates/{id} -> {card, revision, brief?, manifest?, files}; UseTemplate
// POST /v1/games/{id}/draft/template {template_game_uuid, base_revision, idempotency_key} -> as a
// change; 404 template_not_found.

// ReadSimulationState reads one value of a kept result.
// endpoint: GET /v1/games/{id}/draft/simulations/{resultID}/state[?at_ms][&of][&path] ->
// {of, path, at_ms, final?, value | too_large, size, keys | length}; 404 not_observed
// {observed_at_ms} / path_not_found / simulation_not_found (expired) -> answered as missing(reason)
func ReadSimulationState(gameUUID, resultID string, atMs *int, of, path string) (SimulationState, *GamesFailure) {
	return SimulationState{}, nil
}

// SimulationResult keeps the whole answer (Raw) for the person to copy, plus what is summarized.
type SimulationResult struct {
	Raw                                any
	Finished                           *bool
	Stopped, ScriptError               string
	Commands, Rejected, Events, Errors int
}

type AiLink struct{ URL, ExpiresAt string }

type AiLinkStatus struct {
	Active               bool
	CreatedAt, ExpiresAt string
}

// GamesFailure: not-found | not-editable | conflict(currentRevision) | invalid(diagnostics) |
// too-large(diagnostics) | not-declared | idempotency-conflict | revision-not-found |
// build-not-found | build-not-ready(buildStatus) | busy(retryAfterSeconds) | unavailable (no answer, server failure, an unknown
// code or body).
type GamesFailure struct{ Kind string }

// ReadCard reads the game's card (Game Management): name, description, logo, photos, visibility,
// whether it is published, whether an edition is open and whether a publication is under way.
// GET /v1/games/{id}
func ReadCard(gameUUID string) (GameCard, *GamesFailure) { return GameCard{}, nil }

// UpdateCard changes the card's name and/or description. PATCH /v1/games/{id}
func UpdateCard(gameUUID string, name *string, description *string) *GamesFailure { return nil }

// UploadLogo / UploadPhoto send one picked image as the body with its own Idempotency-Key.
// PUT /v1/games/{id}/logo, POST /v1/games/{id}/photos
func UploadLogo(gameUUID string, image []byte, idempotencyKey string) *GamesFailure  { return nil }
func UploadPhoto(gameUUID string, image []byte, idempotencyKey string) *GamesFailure { return nil }

// RemoveLogo / RemovePhoto. POST /v1/games/{id}/logo/remove, POST /v1/games/{id}/photos/{photoID}/remove
func RemoveLogo(gameUUID string) *GamesFailure                    { return nil }
func RemovePhoto(gameUUID string, photoUUID string) *GamesFailure { return nil }

// Publish publishes the CURRENT revision of the open edition; a refusal lists its blockers
// (build not succeeded, required assets missing, invalid name, the draft changed meanwhile).
// POST /v1/games/{id}/publish
func Publish(gameUUID string, visibility string, name *string, idempotencyKey string) (Publication, *GamesFailure) {
	return Publication{}, nil
}

// OpenEdition opens a new edition of a published game: its draft starts at revision 1 with the
// published sources. POST /v1/games/{id}/editions
func OpenEdition(gameUUID string, idempotencyKey string) (struct{ Revision int }, *GamesFailure) {
	return struct{ Revision int }{}, nil
}

// ListGames reads the account's own games, newest first. GET /v1/games
// code: packages/communication/src/gamesClient.ts#listGames
func ListGames() ([]MyGame, *GamesFailure) { return nil, nil }

// ReadAiAuthorization reads what an AI app asks for (MCP's OAuth consent). 404: unknown,
// expired or already decided. GET /v1/ai-authorizations/{requestID}
// code: packages/communication/src/aiAccessClient.ts#readAuthorization
func ReadAiAuthorization(requestID string) (AiAuthorizationRequest, *AiAccessFailure) {
	return AiAuthorizationRequest{}, nil
}

// ApproveAiAuthorization / DenyAiAuthorization answer the AI app's URL the browser goes to.
// POST /v1/ai-authorizations/{requestID}/approve, POST /v1/ai-authorizations/{requestID}/deny
func ApproveAiAuthorization(requestID string) (string, *AiAccessFailure) { return "", nil }
func DenyAiAuthorization(requestID string) (string, *AiAccessFailure)    { return "", nil }

// ListAiConnections / RevokeAiConnection: the account's connected AI apps.
// GET /v1/ai-connections, POST /v1/ai-connections/{connectionID}/revoke
func ListAiConnections() ([]AiConnection, *AiAccessFailure) { return nil, nil }
func RevokeAiConnection(connectionID string) *AiAccessFailure { return nil }

