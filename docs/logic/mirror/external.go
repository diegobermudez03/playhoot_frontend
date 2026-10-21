// PSEUDOCODE — Go syntax, not compiled.
// EXTERNAL: every call the frontend makes to the backend, as bare functions (inputs -> DTO).
// Every call goes to the same origin as the page (in development the Vite proxy forwards
// /v1 to the backend). Contract details: docs/architecture/BACKEND_CONTRACT.md.
package mirror

// ─── HTTP ──────────────────────────────────────────────────────────────────

// CreateGuest creates a guest identity for someone without an account.
//
//	POST /v1/guests   (no Authorization header)
//	body: {"display_name": displayName, "idempotency_key": idempotencyKey}
//
// code: packages/communication/src/identityClient.ts#createGuest
func CreateGuest(displayName string, idempotencyKey string) (CreatedGuest, *HttpFailure) {
	// 201 -> CreatedGuest
	// 400 -> HttpFailure{Status: 400}            (name rejected)
	// 429 -> HttpFailure{Code: "rate_limited", RetryAfterSeconds}
	// network down / anything else -> HttpFailure{Kind: "network" | "http"}
	return CreatedGuest{}, nil
}

type CreatedGuest struct {
	UserUUID string
	Token    string // opaque; sent later as "Bearer <token>" or inside the WebSocket subprotocol
}

// Every HTTP call goes through one client that:
//   - attaches "Authorization: Bearer <token>" from the global credential when the call needs it;
//   - never throws: it returns a value or an HttpFailure;
//   - when the backend answers 401 with code "token_invalid" to a call that carried a token,
//     calls SignOut() in state_app.go (the stored credential is dead).
//
// code: packages/communication/src/http.ts#createHttpClient
type HttpFailure struct {
	Kind              string // "network" (no answer) | "http" (error status) | "decode" (body breaks the contract)
	Status            int
	Code              string // backend's stable reason when present: token_required, token_invalid, rate_limited...
	RetryAfterSeconds int
}

// ─── Storage (not the backend API) ──────────────────────────────────────────

// FetchGameArtifact downloads a game's frontend artifact (one HTML file today).
//
//	GET <session_started.frontend.url>   (a signed storage URL, valid 15 min; no cookies sent)
//
// Only called when the browser's artifact cache has nothing for that SHA-256. The answer is
// accepted only if its SHA-256 equals session_started.frontend.sha256. Needs CORS on the bucket
// (fake-gcs in development allows any origin).
//
// code: packages/game-host/src/artifact.ts#createArtifactLoader
func FetchGameArtifact(signedURL string) ([]byte, *HttpFailure) {
	return nil, nil
}

// ─── WebSocket (one live connection per player per Session) ────────────────

// OpenPlayerConnection opens the realtime connection. Opening it IS joining.
//
//	by code:    GET ws(s)://<origin>/v1/play/join/{joinCode}
//	by Session: GET ws(s)://<origin>/v1/play/join/sessions/{sessionUUID}/player
//	subprotocols: "playhoot.v1", "base64url.bearer.authorization.playhoot.<base64url(token)>"
//
// Returns NoCredential without opening anything when there is no token.
// If the backend refuses the handshake (bad code, auth, rate limit, Session not joinable),
// the browser only sees a close before "open": the reason is invisible (BACKEND_CONTRACT G/Z10).
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
func CloseSocket(s Socket)                                             {} // client closes (code 1000), no leave

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
	Frontend      struct{ URL, SHA256, ExpiresAt string } // the game's frontend artifact (signed URL)
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

type Rejected struct{ Reason string }            // "rejected": admission refused, then close
type SessionEnd struct{ Status, EndCause string } // "session_ended" | "lobby_closed"
type LeaveResult struct{ Outcome string }         // "leave_result"

type Socket struct{}
