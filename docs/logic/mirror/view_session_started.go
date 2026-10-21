// PSEUDOCODE — Go syntax, not compiled.
// SCREEN (inside the Session route): the game — phase "started". Session Play.
//
// One Session Play feature (state_sessionplay.go) per started game. It is created when the phase
// becomes "started" and kept while the same game runs: a reconnection re-sends "session_started"
// with the same participant and frontend, and the phase stays "started" meanwhile, so the game is
// NOT reloaded. It is disposed when this screen goes away (an ending, leaving, another route).
//
// code: apps/web/src/features/session-play/SessionPlayView.tsx, PlayScreen.tsx
package mirror

func StartedScreen(join *JoinSession) {
	play := SessionPlayOnShown(join)

	// Shown on screen: "Jugador 2 de 3" / "Player 2 of 3" / "Jogador 2 de 3", and the game area.
	// Over the game area, by state:
	//   play.State.Game.Phase "loading" | "starting" -> "¡Empieza el juego! … Cargando el juego…"
	//   play.State.Game.Phase "failed"               -> "No pudimos cargar el juego" + a reason:
	//        artifact-unreachable -> check your connection; unsupported-bridge-version -> reload the
	//        page (a newer Playhoot is needed); anything else -> the game has a problem
	//   join.State.View.Connection == "reconnecting" -> banner "Se perdió la conexión. Reconectando…"

	// When: the game area is on screen (and again after a reload).
	play.Attach(NewIframeContainer()) // state_sessionplay.go -> StartGameHost (state_gamehost.go)

	// When: "Salir" / "Leave" / "Sair" (top right), or "Salir de la partida" on the failure overlay.
	join.Leave() // state_joinsession.go -> backend leave -> outcome "left" -> Enter a code

	// When: "Intentar de nuevo" / "Try again" / "Tentar de novo" on the failure overlay.
	play.Reload() // loads the game again in the same area

	// When: the game ends or is cancelled.
	join.OnSessionEnd(SessionEnd{}, false) // -> phase "closed" -> this screen goes away -> play.Dispose()

	// When: the connection drops (the backend keeps the player for 3 s).
	join.OnConnectionClosed("retryable", 0, true) // phase stays "started", Connection "reconnecting"
}

// SessionPlayOnShown creates the feature once per game.
// rule: same ParticipantID + same frontend SHA-256 -> keep the instance (a reconnection).
func SessionPlayOnShown(join *JoinSession) *SessionPlay {
	return NewSessionPlay(join.State.View.Started, uiLocale, join.Live) // state_sessionplay.go
}

var uiLocale string
