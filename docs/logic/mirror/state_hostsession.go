// PSEUDOCODE — Go syntax, not compiled.
// STATE: the Session Host feature — the logic behind the host screen (view_host.go). One admin
// connection, kept across reconnections; the backend decides everything it answers.
// code: packages/features/session-host/src/hostSession.ts
package mirror

type HostSessionState struct {
	SessionUUID  string
	JoinCode     string // from the URL; the backend tells it only when the Session is created
	View         HostView
	Playing      bool // the creator joined as a player from this page
	WatchBlocked bool // the backend refused to show other players (the creator plays, here or elsewhere)
	Cancelling   bool
}

type HostView struct {
	Phase string // "connecting" | "lobby" | "started" | "closed"

	ReconnectAttempt       int           // connecting
	Members                []LobbyMember // lobby: in join order, IsYou = the creator's own player
	MinPlayers, MaxPlayers int           // lobby: the game's limits (0 = the backend did not say)
	Starting               bool          // lobby: waiting for start_session_result
	StartError             string        // lobby: invalid_player_count | game_unavailable | start_failed | sandbox_unavailable | not_in_lobby | unavailable
	Participants           []struct{ ParticipantID, UserUUID, DisplayName string }
	Watching               string // started: the participant whose view the admin gets
	Connection             string // started: "connected" | "reconnecting"
	Outcome                string // closed: ended (status, end cause) | rejected (reason) | unreachable | connection-lost | protocol-error
}

type HostSession struct{ State HostSessionState }

func NewHostSession(sessionUUID, joinCode string) *HostSession { return &HostSession{} }

// Start opens the admin connection. external.go: WebSocket /v1/play/join/sessions/{uuid}/admin.
// Server messages:
//   lobby_update     -> View = lobby (members, limits)
//   session_started  -> View = started; then Watch(the same participant as before a reconnection,
//                       else the first) unless Playing or WatchBlocked
//   player_view      -> the watched player's state, reconciled like a player's (patches, revision
//                       gaps -> resync); handed to the GameHost read only
//   session_ended / lobby_closed -> View = closed (ended, status, end cause)
//   rejected         -> View = closed (rejected, reason)
// Connection closed:
//   rule: first handshake fails -> closed "unreachable"; lost later -> reconnect after 1, 2, 4 s
//         (the game stays on screen as "reconnecting"), then closed "connection-lost".
func (h *HostSession) Start() {}

// StartGame: "Iniciar partida". rule: the button is enabled only when the member count is within
// the game's limits; the backend still decides (invalid_player_count shown as an error).
// started / already_started / start_in_progress -> wait for session_started.
func (h *HostSession) StartGame() {} // {"type":"start_session"} -> start_session_result

// Cancel: the Session ends for everyone; the end arrives as lobby_closed / session_ended.
func (h *HostSession) Cancel() {} // {"type":"cancel_session"} -> cancel_session_result

// Watch: shows one participant's game.
// rule: only the watched participant's views reach the game, and its current view is given to a new
//       game run only once it is that participant's (before their FULL view, the game starts empty).
// rule: creator_is_playing -> WatchBlocked (no more watching); any other answer but "selected" ->
//       back to the participant watched before.
func (h *HostSession) Watch(participantID string) {} // {"type":"select_perspective","participant_id"}

// PlayToo: lobby only. The page opens a player connection for the creator (view_session.go,
// embedded) beside the admin one; start and cancel stay on the admin connection.
func (h *HostSession) PlayToo() {}

// JoinAndStart: "Unirme y empezar". Plays too, and starts once the creator's player connection is
// in the lobby (PlayerInLobby, told by that connection's owner). rule: not from the admin's lobby
// updates: an older player connection that is closing may still be listed there, and starting then
// would leave the creator out of the game.
func (h *HostSession) JoinAndStart() {}

// PlayerInLobby: the creator's current player connection reached the lobby; starts a pending
// "join and start", once.
func (h *HostSession) PlayerInLobby() {}

// StopPlaying: the creator's player part ended (a leave, a refusal, a failure); back to the admin
// screens, and a pending "join and start" is dropped.
func (h *HostSession) StopPlaying() {}

// Retry: "Intentar de nuevo" on the outcome screen.
func (h *HostSession) Retry() {}

// The GameHost's read-only link (code: hostSession.ts#live): SAMPLEs and COMMANDs the watched game
// sends are dropped (a COMMAND answers "connection-closed"), game faults are not reported, and the
// current view has no ack.
