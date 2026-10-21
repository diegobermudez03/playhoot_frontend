// PSEUDOCODE — Go syntax, not compiled.
// STATE: Session Play — runs the started game for this player through the GameHost.
//
// Lifecycle (lobby, started, endings) and the connection stay with Join Session
// (state_joinsession.go), which owns the WebSocket; Session Play only runs the game on top of the
// Join's live link (join.Live), which always talks to the current connection.
//
// code: packages/features/session-play/src/sessionPlay.ts
package mirror

type SessionPlay struct {
	State SessionPlayState

	Start     *StartedSession // from "session_started": participant, roster, frontend URL + SHA-256
	Locale    string          // the UI language, told to the game
	Live      LiveSession     // join.Live
	host      *GameHost       // state_gamehost.go; at most one
	container *IframeContainer
}

type SessionPlayState struct {
	Game                GameHost // its Phase/Error drive the overlays (view_session_started.go)
	RefusedGameMessages int      // game messages the Host refused (recorded, not fatal)
}

func NewSessionPlay(start *StartedSession, locale string, live LiveSession) *SessionPlay {
	return &SessionPlay{Start: start, Locale: locale, Live: live, State: SessionPlayState{Game: GameHost{Phase: "loading"}}}
}

// Attach runs the game in the screen's game area.
func (p *SessionPlay) Attach(container *IframeContainer) {
	p.container = container
	p.run()
}

// Reload: after a failure, the same game again in the same area.
func (p *SessionPlay) Reload() { p.run() }

func (p *SessionPlay) run() {
	if p.host != nil {
		p.host.Dispose()
	}
	p.host = StartGameHost(
		struct{ URL, SHA256 string }{p.Start.Frontend.URL, p.Start.Frontend.SHA256},
		p.Live, // the GameSessionPort
		GameContext{ParticipantID: p.Start.ParticipantID, Participants: participantIDs(p.Start), Locale: p.Locale},
	)
	// Every GameHost status change -> p.State.Game.
	// Every refused game message -> p.State.RefusedGameMessages++.
	// Development builds also print load/READY times and refusals to the browser console ("[game]").
}

// Dispose: the screen went away. Closes the game; the connection is Join's and stays untouched.
func (p *SessionPlay) Dispose() {
	if p.host != nil {
		p.host.Dispose()
	}
}

// LiveSession is the Join's link to whatever connection is current (state_joinsession.go#Live).
type LiveSession interface {
	CurrentView() (state any, ack int, ok bool)
	Sample(inputs map[string]any)
	Command(name string, payload map[string]any) CommandResult
}

func participantIDs(s *StartedSession) []string { return nil }

// NewIframeContainer: the web container (apps/web/src/platform/iframeGameContainer.ts) in the game area.
func NewIframeContainer() *IframeContainer { return &IframeContainer{} }
