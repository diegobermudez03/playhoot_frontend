// PSEUDOCODE — Go syntax, not compiled.
// SCREEN (inside the Session route): "Game on!" — phase "started".
// PLACEHOLDER: shows which player you are; the game itself (Session Play) is a later step.
// From here the connection also receives the game's views; nothing reads them yet.
// code: apps/web/src/features/session-join/SessionScreen.tsx#StartedStep
package mirror

func StartedScreen(join *JoinSession) {
	// When: the game ends or is cancelled.
	join.OnSessionEnd(SessionEnd{}, false) // state_joinsession.go -> phase "closed"

	// When: the connection drops (the backend keeps the player for 3 s).
	join.OnConnectionClosed("retryable", 0, true) // -> reconnect by Session UUID

	// When: the server sends a view of the game or answers a command.
	// Handled by the connection itself (state_connection.go); the Join feature ignores them.
}
