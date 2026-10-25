// PSEUDOCODE — Go syntax, not compiled.
// STATE: the Join Session feature — the logic behind every screen of the Session route
// (view_session*.go), from "who are you?" to the game start.
//
// The views call these methods; the screen shown follows State.View.Phase.
// In the real code the connection's events reach one dispatcher that calls the On* methods below.
// code: packages/features/session-join/src/joinSession.ts
package mirror

// JoinSessionState is the feature's whole state. It lives while a Session route is on screen and is
// thrown away when the person leaves it. Nothing of it is persisted.
type JoinSessionState struct {
	Target      SessionTarget // what the URL asked for (code or Session UUID)
	SessionUUID string        // learned from the backend; once known, the URL names it (view_session.go)
	View        JoinView      // the current phase; decides the screen
}

// JoinView: one phase at a time, with the data that phase needs.
type JoinView struct {
	Phase string // "identity" | "connecting" | "lobby" | "started" | "leaving" | "closed"

	Submitting       bool           // identity: waiting for POST /v1/guests
	IdentityError    *IdentityError // identity: why the name was not accepted
	ReconnectAttempt int            // connecting: 0 first try, 1..3 reconnecting
	Members          []LobbyMember  // lobby
	Started          *StartedSession
	Connection       string       // started: "connected" | "reconnecting" (the game stays on screen)
	Outcome          *JoinOutcome // closed
}

type LobbyMember struct {
	UserUUID    string
	DisplayName string // from the backend's Identity; "" when it has none
	IsYou       bool   // computed: UserUUID == global.Auth.UserUUID
}

type StartedSession struct {
	ParticipantID string // "P2": this player
	Participants  []struct {
		ParticipantID, UserUUID, DisplayName string
		IsYou                                bool
		Status                               string // "active" at the start; then from roster_update ("unknown" for a status this code does not know)
	}
	Frontend struct { // the game's frontend, run by Session Play
		URL, SHA256, ExpiresAt string
		Viewport               Viewport // external.go: the game's fixed shape and logical size
	}
}

type IdentityError struct {
	Kind              string // "invalid-name" | "rate-limited" | "unavailable"
	Reason            string // invalid-name: "empty" | "too-long" | "rejected"
	MaxLength         int    // 64
	RetryAfterSeconds int
}

type JoinOutcome struct {
	Kind        string // "rejected" | "unreachable" | "ended" | "left" | "game-stopped" | "game-error" | "replaced" | "connection-lost" | "protocol-error"
	Reason      string // rejected: invalid_join_code, join_code_expired, device_not_supported (+ Requirements), invalid_session, lobby_full, session_started, session_unavailable, participant_disconnected, rejoin_rejected, server_busy, owner_changed, or "unknown"
	Status      string // ended: FINISHED | CANCELLED | EXPIRED | ABORTED
	EndCause    string // ended: HOST_CANCELLED, LOBBY_EXPIRED, GAME_FINISHED...
	BeforeStart bool   // ended: the lobby closed before the game started
}

type JoinSession struct {
	State      JoinSessionState
	// Live is the link Session Play uses: Sample / Command / CurrentView always go to the CURRENT
	// connection (nothing while there is none: Command answers "connection-closed"), and it
	// forwards that connection's "open", "view" and "sample-sent" events. A new connection after a
	// reconnection announces itself with "open". Its listeners are dropped on Dispose.
	Live       LiveSession
	connection *ConnectionState // state_connection.go; at most one at a time
	attempt    int              // which connection attempt is current
	pendingKey struct{ Name, Key string }
	// leftOutcome is what leaving ends in: "left", or "game-stopped" when the game was stopped
	// for misbehaving.
	leftOutcome string
}

// ─── Lifecycle ─────────────────────────────────────────────────────────────

func NewJoinSession(target SessionTarget) *JoinSession {
	j := &JoinSession{State: JoinSessionState{Target: target, View: JoinView{Phase: "connecting"}}}
	if target.Kind == "session" {
		j.State.SessionUUID = target.SessionUUID
	}
	return j
}

// PointsAt: does this feature already serve that URL? (same Session UUID, or same code)
func (j *JoinSession) PointsAt(target SessionTarget) bool { return false }

// Dispose: the route was left. Closes the connection WITHOUT sending leave; cancels a pending reconnect.
func (j *JoinSession) Dispose() { j.dropConnection() }

// ─── Intents (called by the views) ─────────────────────────────────────────

// Start: right after creation, and again on Retry.
func (j *JoinSession) Start() {
	if global.Auth.Status == "guest" || global.Auth.Status == "authenticated" {
		j.connect(0) // already someone: the name is not asked again
		return
	}
	j.State.View = JoinView{Phase: "identity"} // -> IdentityScreen
}

// SubmitDisplayName: "Let's play" on the identity screen.
func (j *JoinSession) SubmitDisplayName(raw string) {
	name := trim(raw)
	// rule: 1..64 characters, else IdentityError{invalid-name, empty | too-long}; the backend is not called.

	// rule: same name submitted again -> same idempotency key, so a retry never creates two guests.
	if j.pendingKey.Name != name {
		j.pendingKey.Name, j.pendingKey.Key = name, newUUID()
	}
	j.State.View = JoinView{Phase: "identity", Submitting: true}

	guest, failure := CreateGuest(name, j.pendingKey.Key) // external.go: POST /v1/guests

	if failure != nil {
		// rule: 400 -> invalid-name/rejected · code rate_limited -> rate-limited (+ seconds) · else unavailable.
		j.State.View = JoinView{Phase: "identity", IdentityError: &IdentityError{}} // stays on IdentityScreen
		return
	}
	SignIn(Credential{Token: guest.Token, UserUUID: guest.UserUUID, Kind: "guest", DisplayName: name}) // state_app.go (persisted)
	j.connect(0)
}

// Retry: "Try again" / "Play here" on the outcome screen, and after a dev account is picked.
func (j *JoinSession) Retry() { j.Start() }

// Leave: "Leave game" on the lobby screen, "Salir" during the game, or Session Play when the game
// was stopped for misbehaving (reason "game-stopped", see state_sessionplay.go).
// rule: the outcome is "game-stopped" for that reason, "left" otherwise.
func (j *JoinSession) Leave(reason string) {
	j.leftOutcome = "left"
	if reason == "game-stopped" {
		j.leftOutcome = "game-stopped"
	}
	if j.connection != nil && j.State.View.Phase != "closed" {
		j.State.View = JoinView{Phase: "leaving"} // -> ConnectingScreen ("Leaving the game…")
		j.connection.Leave()                      // sends {"type":"leave"}; the server closes as "left" -> OnConnectionClosed
		return
	}
	j.dropConnection()
	j.State.View = outcome(j.leftOutcome)
}

// ─── Connecting ────────────────────────────────────────────────────────────

func (j *JoinSession) connect(attempt int) {
	j.dropConnection()
	target := j.State.Target
	if j.State.SessionUUID != "" {
		// rule: once the Session is known, always connect by Session UUID (the code dies at start).
		target = SessionTarget{Kind: "session", SessionUUID: j.State.SessionUUID}
	}

	socket, noCredential := OpenPlayerConnection(target) // external.go: WebSocket /v1/play/join/...

	if noCredential != nil {
		j.State.View = JoinView{Phase: "identity"} // -> IdentityScreen
		return
	}
	j.attempt = attempt
	j.State.View = JoinView{Phase: "connecting", ReconnectAttempt: attempt} // -> ConnectingScreen
	j.connection = connectionOf(socket)                                      // its events call the On* methods below
}

// ─── Events from the server (through the connection) ───────────────────────

// OnLobbyUpdate: "lobby_update" — joined the lobby, or someone joined/left. Always the whole list.
// While "leaving", lobby updates, session_started and roster updates are ignored: a player who
// leaves while the game starts may still be told it started before the backend applies the leave.
func (j *JoinSession) OnLobbyUpdate(m LobbyUpdate) {
	j.State.SessionUUID = m.SessionUUID                            // -> the view replaces the URL
	j.State.View = JoinView{Phase: "lobby", Members: membersOf(m)} // -> LobbyScreen
}

// OnSessionStarted: "session_started" — the game began (also re-sent after a reconnection).
func (j *JoinSession) OnSessionStarted(m SessionStarted) {
	j.State.SessionUUID = m.SessionUUID
	j.State.View = JoinView{Phase: "started", Started: startedOf(m), Connection: "connected"} // -> StartedScreen (the game)
}

// OnRosterUpdate: "roster_update" — during the game, someone's presence changed (or it is the first
// one after session_started). Only in phase "started"; ignored otherwise.
func (j *JoinSession) OnRosterUpdate(m RosterUpdate) {
	// rule: each participant gets the Status (and DisplayName) the update gives for its ParticipantID;
	// participants it does not mention keep theirs. -> the game screen's players list updates.
}

// OnRejected: "rejected" — the backend refused the player; the connection closes right after.
func (j *JoinSession) OnRejected(m Rejected) {
	// rule: "session_ended" (joining by Session UUID a Session that already ended) is shown as the
	// end it was: Outcome{Kind: "ended", Status, EndCause, BeforeStart: Status == "EXPIRED"}.
	j.State.View = JoinView{Phase: "closed", Outcome: &JoinOutcome{Kind: "rejected", Reason: m.Reason}} // -> OutcomeScreen
}

// OnSessionEnd: "lobby_closed" (beforeStart) or "session_ended".
func (j *JoinSession) OnSessionEnd(m SessionEnd, beforeStart bool) {
	j.State.View = JoinView{Phase: "closed", Outcome: &JoinOutcome{Kind: "ended", Status: m.Status, EndCause: m.EndCause, BeforeStart: beforeStart}}
}

// OnProtocolError: a server message broke the contract.
func (j *JoinSession) OnProtocolError() {
	j.dropConnection()
	j.State.View = outcome("protocol-error")
}

// OnConnectionClosed: the WebSocket closed. kind comes from state_connection.go#classifyClose.
func (j *JoinSession) OnConnectionClosed(kind CloseKind, attempt int, opened bool) {
	if j.State.View.Phase == "closed" {
		return // a rejection or an end message already decided the outcome
	}
	if j.State.View.Phase == "leaving" {
		j.State.View = outcome(j.leftOutcome) // "left" or "game-stopped"
		return
	}
	switch kind {
	case "left":
		j.State.View = outcome(j.leftOutcome)
	case "replaced":
		j.State.View = outcome("replaced") // same player connected elsewhere: never reconnect by itself
	case "session-ended":
		j.State.View = JoinView{Phase: "closed", Outcome: &JoinOutcome{Kind: "ended", Status: "UNKNOWN"}}
	case "protocol":
		j.State.View = outcome("protocol-error")
	case "unreachable", "retryable", "disconnected":
		if kind == "unreachable" && attempt == 0 {
			j.State.View = outcome("unreachable") // network, auth, limits or a busy server (a bad code is "rejected")
			return
		}
		// rule: up to 3 reconnections, waiting 1 s, 2 s, then 4 s; a connection that had opened
		// restarts the count. After the 3rd failure -> outcome("connection-lost").
		next := attempt + 1
		if opened {
			next = 1
		}
		if next > 3 {
			j.State.View = outcome("connection-lost")
			return
		}
		if j.State.View.Phase == "started" {
			// rule: during a game the phase stays "started" so the game is not torn down; the
			// screen shows a "reconnecting" banner over it. The next session_started sets it back
			// to "connected".
			j.State.View.Connection = "reconnecting"
		} else {
			j.State.View = JoinView{Phase: "connecting", ReconnectAttempt: next} // -> ConnectingScreen
		}
		afterDelay(next, func() { j.connect(next) })
	}
}

func (j *JoinSession) dropConnection() {} // cancels a pending reconnect and closes the connection (no leave)

func outcome(kind string) JoinView               { return JoinView{Phase: "closed", Outcome: &JoinOutcome{Kind: kind}} }
func membersOf(m LobbyUpdate) []LobbyMember      { return nil } // marks IsYou
func startedOf(m SessionStarted) *StartedSession { return nil } // marks IsYou by ParticipantID
func connectionOf(s Socket) *ConnectionState     { return nil }
func trim(s string) string                       { return s }
func afterDelay(attempt int, f func())           {} // 1000, 2000, 4000 ms
