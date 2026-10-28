// PSEUDOCODE — Go syntax, not compiled.
// VIEWS: the creator's side of a Session.
//   "/sessions/new" — creates a Session and moves to its host screen.
//   "/sessions/{sessionUUID}/host?code={joinCode}" — the host screen: lobby, start, cancel, watching
//   the players, or playing too.
// code: apps/web/src/features/session-host/CreateSessionRoute.tsx, HostRoute.tsx, HostGameView.tsx
package mirror

// CreateSessionView needs CREATE_SESSION (accounts): routes.go#RequireOperation sends anyone else
// to sign in first and back here.
func CreateSessionView() {
	// rule: one idempotency key per visit, so a retry (or React's double effect in development)
	//       never creates two Sessions.
	key := newUUID()
	// placeholder: the game is fixed in the frontend (Space Drift's seed UUID) until there is a
	// catalog to choose from. code: apps/web/src/features/session-host/hostedGame.ts
	created, failure := CreateSession(HostedGameUUID, key) // external.go: POST /v1/sessions
	if failure != nil {
		// rule: 404 -> "This game isn't available right now"; anything else -> "We couldn't create
		//       the game"; both offer "Try again" with the same key.
		return
	}
	// REPLACE, so going back does not create another Session.
	ReplaceURL(HostURL(created.SessionUUID, created.JoinCode))
}

// HostView needs JOIN_SESSION_AS_ADMIN (accounts). It owns the Session Host feature
// (state_hostsession.go) while it is on screen; reloading rebuilds it from the URL.
func HostView(sessionUUID string, joinCode string) {
	host := NewHostSession(sessionUUID, joinCode) // state_hostsession.go
	host.Start()                                  // opens the admin connection

	// Which screen is shown:
	switch {
	case host.State.Playing && host.State.View.Phase != "closed":
		// The creator plays from here: the player's screens of this Session (view_session.go,
		// embedded: it never changes the URL, and any end of the player's part, a leave, a refusal
		// or a stopped game, calls host.StopPlaying()), with the
		// host bar above: "Iniciar partida" (lobby, enabled by the player limits) and "Cancelar".
	case host.State.View.Phase == "connecting":
		// "Opening your game…" / "Connection lost. Reconnecting…"
	case host.State.View.Phase == "lobby":
		// Invite (code tiles + "Copiar enlace de invitación": the code link, or the Session link
		// when the code is unknown), players, then:
		// When: "Iniciar partida" (enabled only when the count is within the game's limits; under
		//       it "N more players needed" / "at most M" / "from M to N players").
		host.StartGame()
		// When: "Jugar también".
		host.PlayToo()
		// When: "Cancelar partida" then "Sí, cancelar" (asks once more).
		host.Cancel()
	case host.State.View.Phase == "started":
		// "Viendo a" + one button per participant (unless WatchBlocked: then only a note that a
		// creator who plays cannot watch the others), the watched player's game read only, and
		// "Cancelar partida".
		// When: the creator presses a participant.
		host.Watch("P2")
	case host.State.View.Phase == "closed":
		// The outcome, by what ended it (code: HostRoute.tsx#closedCopy):
		//   cancelled by the host, ended, or refused session_ended -> "the game is over" texts;
		//   not_creator -> "you can't manage this game"; invalid_session -> "we couldn't find that
		//   game"; session_unavailable -> "the lobby closed"; protocol error -> "something went wrong";
		//   a limit (rate_limited, too_many_connections, server_busy) -> "you reached the limit for
		//   now" with "Try again"; too_many_admins -> "open in too many tabs" with "Try again";
		//   unreachable, connection lost, or an unknown refusal -> their text with "Try again".
		// When: "Intentar de nuevo" -> host.Retry().
		// When: "Volver al inicio" -> Navigate(EnterCodeURL).
	}
}

const HostedGameUUID = "33333333-3333-4333-8333-333333333333"
