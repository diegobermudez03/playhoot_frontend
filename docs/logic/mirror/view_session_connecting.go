// PSEUDOCODE — Go syntax, not compiled.
// SCREEN (inside the Session route): the owl waiting — phases "connecting" and "leaving".
// "Joining ABC234…", "Connection lost. Reconnecting…" or "Leaving the game…".
// The person cannot do anything here; everything that happens comes from the server.
// code: apps/web/src/features/session-join/SessionScreen.tsx#ConnectingStep
package mirror

func ConnectingScreen(join *JoinSession) {
	// When: the server admits the player into the lobby (first message after joining).
	join.OnLobbyUpdate(LobbyUpdate{}) // state_joinsession.go -> phase "lobby"

	// When: reconnecting to a game already running (the backend reattaches or rejoins the player).
	join.OnSessionStarted(SessionStarted{}) // -> phase "started"

	// When: the server refuses the player (lobby full, game already started, not allowed back...).
	join.OnRejected(Rejected{}) // -> phase "closed"

	// When: the connection closes (refused before opening, network lost, left while "leaving"...).
	join.OnConnectionClosed("retryable", 0, false) // -> retry, or phase "closed"
}
