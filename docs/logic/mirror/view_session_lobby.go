// PSEUDOCODE — Go syntax, not compiled.
// SCREEN (inside the Session route): the lobby — phase "lobby". "You're in!", invite card,
// players list, "Leave game".
// code: apps/web/src/features/session-join/SessionScreen.tsx#LobbyStep
package mirror

// LobbyScreenState is this screen's own state.
type LobbyScreenState struct {
	Copied bool // shows "Link copied!" for 2 seconds
}

func LobbyScreen(join *JoinSession) {
	screen := &LobbyScreenState{}

	// When: someone joins or leaves the lobby (the server sends the whole list again).
	join.OnLobbyUpdate(LobbyUpdate{}) // state_joinsession.go -> new Members

	// Shown for each member: their name. rule: for the person on this device, the name they typed
	// (every guest is the same placeholder user in the backend today); otherwise the DisplayName
	// from the backend; with neither, "Jugador N" / "Player N" / "Jogador N".

	// When: the host starts the game.
	join.OnSessionStarted(SessionStarted{}) // -> phase "started"

	// When: the lobby closes before starting (it expired, or the host cancelled).
	join.OnSessionEnd(SessionEnd{}, true) // -> phase "closed"

	// When: the connection drops.
	join.OnConnectionClosed("retryable", 0, true) // -> reconnect by Session UUID

	// When: the person presses "Copiar enlace de invitación" / "Copy invite link" / "Copiar link de convite".
	LobbyOnCopyInvite(join, screen)

	// When: the person presses "Salir de la partida" / "Leave game" / "Sair da partida".
	LobbyOnLeave(join)
}

// LobbyOnCopyInvite copies a shareable link. No call, no navigation.
func LobbyOnCopyInvite(join *JoinSession, screen *LobbyScreenState) {
	// rule: the code link (/join/CODE) when the person came with a code, otherwise the Session link.
	link := JoinURL(join.State.Target.JoinCode)
	if join.State.Target.Kind == "session" {
		link = SessionPlayURL(join.State.SessionUUID)
	}
	copyToClipboard(link)
	screen.Copied = true
}

// LobbyOnLeave leaves the game.
func LobbyOnLeave(join *JoinSession) {
	join.Leave() // state_joinsession.go -> sends "leave" -> phase "leaving" -> "closed(left)"
	// -> SessionRouteOnLeft (view_session.go) navigates to Enter a code.
}

func copyToClipboard(text string) {}
