// PSEUDOCODE — Go syntax, not compiled.
// STATE: ONE live player connection — what it keeps, what it sends, and what it turns server
// messages into. A feature (state_joinsession.go) owns it and only sees its events; it never
// touches the socket. How its events reach the feature:
//
//	"message" lobby_update     -> JoinSession.OnLobbyUpdate
//	"message" session_started  -> JoinSession.OnSessionStarted
//	"message" roster_update    -> JoinSession.OnRosterUpdate
//	"message" rejected         -> JoinSession.OnRejected
//	"message" lobby_closed     -> JoinSession.OnSessionEnd(beforeStart = true)
//	"message" session_ended    -> JoinSession.OnSessionEnd(beforeStart = false)
//	"protocol-error"           -> JoinSession.OnProtocolError
//	"closed"                   -> JoinSession.OnConnectionClosed
//	"view", "sample-sent"      -> nobody yet (Session Play, a later step)
// code: packages/communication/src/sessionConnection.ts
package mirror

// ConnectionState lives as long as one WebSocket. A reconnection creates a new one from zero
// (sequences, revisions and pending commands are per connection).
type ConnectionState struct {
	Socket           Socket
	Opened           bool
	Closed           bool
	SampleSequence   int            // last sent; starts at 0, so the first sample is 1
	PendingInputs    map[string]any // latest snapshot waiting for its send slot
	LastSampleAt     Time
	Views            ViewTracker // the player's state, rebuilt from views
	ResyncRequested  bool        // one resync per gap
	PendingCommands  map[string]PendingCommand
	Listeners        []func(ConnectionEvent) // the feature that owns the connection
}

type PendingCommand struct {
	Message  CommandMessage // resent as is on retry: same token
	Attempts int
	Reply    chan CommandResult
}

type CommandMessage struct {
	Token, Name string
	Payload     map[string]any
}

// What the feature receives.
type ConnectionEvent struct {
	Type    string // "open" | "message" | "view" | "sample-sent" | "protocol-error" | "closed"
	Message any        // lobby_update, session_started, rejected, session_ended, lobby_closed, leave_result
	View    ViewUpdate // for "view"
	Seq     int        // for "sample-sent"
	Close   CloseKind  // for "closed"
}

type CommandResult struct {
	Token    string
	Outcome  string // backend outcome, or "connection-closed" (no answer; retry later with the SAME token), or "too-large" (never sent)
	Response any
}

// ─── Intents from the feature ──────────────────────────────────────────────

// Sample sends the player's full input snapshot.
func (c *ConnectionState) Sample(inputs map[string]any) {
	c.PendingInputs = inputs
	// rule: at most 60 samples per second (backend limit). If called faster, keep only the
	// latest snapshot and send it when the next slot opens (snapshots are complete, so nothing is lost).
	// rule: a sample over 32 KiB is never sent (emits "protocol-error").
	c.SampleSequence++
	SendSample(c.Socket, c.SampleSequence, inputs)
	c.emit(ConnectionEvent{Type: "sample-sent", Seq: c.SampleSequence})
}

// Command runs a game command and waits for its result.
func (c *ConnectionState) Command(name string, payload map[string]any, token string) CommandResult {
	if token == "" {
		token = newUUID()
	}
	// rule: token over 128 chars or message over 32 KiB -> CommandResult{Outcome: "too-large"}, not sent.
	c.PendingCommands[token] = PendingCommand{Message: CommandMessage{token, name, payload}}
	SendCommand(c.Socket, token, name, payload)
	return <-c.PendingCommands[token].Reply // resolved by OnCommandResult or OnClose
}

// CurrentView: the player's state and the ack of the last view, or nothing before the first FULL
// view and while a gap waits for one. Session Play's GameHost starts the game with it.
func (c *ConnectionState) CurrentView() (state any, ack int, ok bool) { return nil, 0, false }

func (c *ConnectionState) Resync() { SendResync(c.Socket) }
func (c *ConnectionState) Leave()  { SendLeave(c.Socket) } // the server answers and closes as "left"

// Close: navigating away. Pending commands resolve "connection-closed"; no more events.
func (c *ConnectionState) Close() {
	c.Closed = true
	c.resolveAllPending("connection-closed")
	c.Listeners = nil
	CloseSocket(c.Socket)
}

// ─── Events from the server ────────────────────────────────────────────────

func (c *ConnectionState) OnOpen() {
	c.Opened = true
	c.emit(ConnectionEvent{Type: "open"})
}

func (c *ConnectionState) OnMessage(msg any) {
	switch m := msg.(type) {
	case PlayerView:
		update := c.Views.Receive(m)
		if update.Kind == "gap" && !c.ResyncRequested {
			SendResync(c.Socket) // the server answers with a FULL view
			c.ResyncRequested = true
		}
		if update.Kind == "state" && update.Full {
			c.ResyncRequested = false
		}
		c.emit(ConnectionEvent{Type: "view", View: update})
	case CommandResultMsg:
		c.OnCommandResult(m)
	case SessionStarted:
		c.ResyncRequested = false // a start is a new baseline: a FULL view follows
		c.emit(ConnectionEvent{Type: "message", Message: m})
	default: // LobbyUpdate, Rejected, SessionEnd, LeaveResult
		c.emit(ConnectionEvent{Type: "message", Message: m})
	}
}

func (c *ConnectionState) OnCommandResult(m CommandResultMsg) {
	pending := c.PendingCommands[m.Token]
	if m.Outcome == "rate_limited" && pending.Attempts < 3 {
		// rule: resend the same message (same token) after 250 ms, then 500 ms, then 1 s.
		pending.Attempts++
		return
	}
	delete(c.PendingCommands, m.Token)
	pending.Reply <- CommandResult{Token: m.Token, Outcome: m.Outcome, Response: m.Response}
}

func (c *ConnectionState) OnClose(code int, reason string) {
	c.Closed = true
	c.resolveAllPending("connection-closed")
	c.emit(ConnectionEvent{Type: "closed", Close: classifyClose(c.Opened, code, reason)})
}

// CloseKind says what the feature should do about a closed connection.
type CloseKind string

// computes (code: sessionConnection.ts#classifyClose):
//
//	never opened                  -> "unreachable"   (handshake refused or network; reason invisible)
//	1000 "session_ended"          -> "session-ended"
//	1000 "left"                   -> "left"
//	1000 "replaced"               -> "replaced"      (same player connected elsewhere: do NOT reconnect)
//	1000 other ("disconnected")   -> "disconnected"
//	1007 "invalid_game_data"      -> "game-data-invalid" (the game sent undeclared data; recorded by the backend)
//	1003, 1007, 1008, 1009        -> "protocol"      (the server judged our message invalid/over limits)
//	anything else (1001,1006,1011,1012) -> "retryable"
func classifyClose(opened bool, code int, reason string) CloseKind { return "" }

// ─── The player's state from views ─────────────────────────────────────────

// ViewTracker rebuilds the player's state from views. code: packages/communication/src/viewState.ts
type ViewTracker struct {
	State    any
	Revision int // -1 = no trustworthy baseline (before the first FULL, or after a gap)
}

type ViewUpdate struct {
	Kind           string // "state" | "ack" | "gap"
	Full           bool
	State          any // whole current state (for "state" and "ack")
	Revision, Ack  int
	Events, Errors []any // delivered even on a gap; never replayed
}

func (t *ViewTracker) Receive(v PlayerView) ViewUpdate {
	switch {
	case v.Full:
		t.State, t.Revision = v.State, v.Revision
		return ViewUpdate{Kind: "state", Full: true, State: t.State}
	case t.Revision >= 0 && v.Revision == t.Revision:
		return ViewUpdate{Kind: "ack", State: t.State} // only ack/errors/events are new
	case t.Revision >= 0 && v.Revision == t.Revision+1:
		// computes: merge the patch into the state — where both sides are objects merge field by
		// field (recursively); anything else in the patch replaces the old value whole.
		t.State, t.Revision = mergePatch(t.State, v.State), v.Revision
		return ViewUpdate{Kind: "state", State: t.State}
	default:
		t.Revision = -1 // lost a view: wait for the FULL the resync brings
		return ViewUpdate{Kind: "gap"}
	}
}

func (c *ConnectionState) emit(e ConnectionEvent)              {}
func (c *ConnectionState) resolveAllPending(outcome string)    {}
func mergePatch(state any, patch any) any                       { return nil }
func newUUID() string                                           { return "" }

type Time struct{}
