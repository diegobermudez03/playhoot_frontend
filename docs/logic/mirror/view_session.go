// PSEUDOCODE — Go syntax, not compiled.
// VIEW: the Session route — "/join/{joinCode}" and "/sessions/{sessionUUID}/play".
//
// Both URLs are the same view. It owns the Join Session feature (state_joinsession.go) and shows
// one screen at a time, chosen by the feature's phase. Every state change re-runs the switch,
// so when an event changes the phase, the next screen appears by itself.
//
// code: apps/web/src/features/session-join/SessionRoute.tsx
package mirror

// The feature instance owned by this view while it is on screen.
var activeJoin *JoinSession

func SessionRouteView(target SessionTarget) {
	// When: this route opens (from Enter a code, a shared link, a refresh) or its URL changes.
	join := SessionRouteOnOpened(target)

	// Which screen is shown, decided by the phase:
	switch join.State.View.Phase {
	case "connecting", "leaving":
		ConnectingScreen(join) // view_session_connecting.go
	case "lobby":
		LobbyScreen(join) // view_session_lobby.go
	case "started":
		StartedScreen(join) // view_session_started.go
	case "closed":
		OutcomeScreen(join) // view_session_outcome.go
	}

	// When: the feature has just learned the Session UUID (first lobby_update or session_started).
	SessionRouteOnSessionUUIDKnown(join)

	// When: the feature's outcome becomes "left" (the person left the game).
	SessionRouteOnLeft(join)

	// When: the person goes to a URL that is not a Session URL (logo, "Enter a code", back button...).
	SessionRouteOnLeftRoute()
}

// SessionRouteOnOpened creates the feature, or keeps it if the URL still points at the same Session.
// code: SessionRoute.tsx#useJoinSession
func SessionRouteOnOpened(target SessionTarget) *JoinSession {
	if activeJoin != nil && activeJoin.PointsAt(target) {
		// e.g. /join/ABC234 was just replaced by /sessions/<its uuid>/play: same feature, same connection.
		return activeJoin
	}
	if activeJoin != nil {
		activeJoin.Dispose() // state_joinsession.go
	}
	activeJoin = NewJoinSession(target) // state_joinsession.go
	activeJoin.Start()                  // decides: ask for a name, or connect right away
	return activeJoin
}

// SessionRouteOnSessionUUIDKnown makes the URL name the Session.
// rule: REPLACE (no new history entry): refresh and reconnection keep working after the game
// starts (the backend releases the code then), and "back" does not return to a dead code URL.
func SessionRouteOnSessionUUIDKnown(join *JoinSession) {
	if join.State.SessionUUID != "" && currentURL() != SessionPlayURL(join.State.SessionUUID) {
		ReplaceURL(SessionPlayURL(join.State.SessionUUID)) // -> SessionRouteView again, keeps the feature
	}
}

// SessionRouteOnLeft sends the person to Enter a code after leaving.
func SessionRouteOnLeft(join *JoinSession) {
	if join.State.View.Phase == "closed" && join.State.View.Outcome.Kind == "left" {
		Navigate(EnterCodeURL) // -> EnterCodeView (view_enter_code.go)
	}
}

// SessionRouteOnLeftRoute throws the feature away: nothing of it survives. Coming back rebuilds it
// from the URL plus the backend.
func SessionRouteOnLeftRoute() {
	activeJoin.Dispose() // closes the connection WITHOUT sending leave (in a lobby the backend drops the player)
	activeJoin = nil
}

func currentURL() string { return "" }
