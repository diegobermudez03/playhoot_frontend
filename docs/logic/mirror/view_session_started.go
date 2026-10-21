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
	//   SuggestsRotation(device, viewport), once the game runs -> at the bottom, "Gira tu dispositivo
	//        para ver el juego más grande" / "Turn your device to see the game bigger" / "Gire o
	//        aparelho para ver o jogo maior" with "Entendido" / "Got it" / "Entendi", which hides it
	//        for this game screen

	// When: the game area is on screen (and again after a reload).
	play.Attach(NewIframeContainer()) // state_sessionplay.go -> StartGameHost (state_gamehost.go)

	// When: the person presses "Jugador 2 de 3" / "Player 2 of 3" / "Jogador 2 de 3" (top left).
	// Opens/closes the players list (presentation only; closes on a click outside or Escape). Each
	// row: avatar, name (same rule as the lobby), "Tú" for this player, and the Status:
	// "Jugando" / "Reconectando…" / "Desconectado" / "Salió de la partida".
	// It follows join.State.View.Started.Participants, which OnRosterUpdate keeps current.
	join.OnRosterUpdate(RosterUpdate{}) // When: the server sends roster_update.

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

// SuggestsRotation: whether to hint turning the device (apps/web/src/features/session-play/rotation.ts).
// rule: only on a touch device that is not a wide screen (width < 1024 px), held the other way from
//       the game (a landscape game on a portrait device, or the reverse). Never for a square game.
//       The game is shown whole either way; turning only makes it bigger.
func SuggestsRotation(device DeviceCapabilities, viewport Viewport) bool {
	gameLandscape := viewport.Width > viewport.Height
	gamePortrait := viewport.Width < viewport.Height
	return device.Touch && device.DisplayClass != "wide" &&
		((gameLandscape && device.Orientation == "portrait") || (gamePortrait && device.Orientation == "landscape"))
}

// DeviceCapabilities: what the device can do, kept current by the browser (packages/device).
type DeviceCapabilities struct {
	Touch        bool
	Orientation  string // "portrait" | "landscape" (width >= height)
	DisplayClass string // "compact" (< 600 px wide) | "medium" (< 1024 px) | "wide"
}
