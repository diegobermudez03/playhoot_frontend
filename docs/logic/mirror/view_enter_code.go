// PSEUDOCODE — Go syntax, not compiled.
// VIEW: Enter a code — "/join" — someone without a link types a join code.
// Not the home page: "/" only redirects here until a real home exists (it comes late).
// code: apps/web/src/features/session-join/EnterCodeRoute.tsx
package mirror

// EnterCodeState is this screen's own state (component state: gone when the screen is left).
type EnterCodeState struct {
	Code string // what the person typed so far
}

func EnterCodeView() {
	screen := &EnterCodeState{}

	// When: the person types, deletes or pastes in the code tiles.
	EnterCodeOnCodeTyped(screen, "hoot4")

	// When: the person presses the button "Unirme" / "Join" / "Entrar" (enabled only with 6 characters).
	EnterCodeOnJoinPressed(screen)

	// When: the person presses "Crear una partida" / "Host a game" / "Criar uma partida" (shown to
	// everyone). rule: without an account, signing in first and back (routes.go#RequireOperation).
	Navigate("/sessions/new") // view_host.go
}

// EnterCodeOnCodeTyped keeps only valid code characters.
func EnterCodeOnCodeTyped(screen *EnterCodeState, typed string) {
	// rule: uppercase; keep only the join-code alphabet (ABCDEFGHJKMNPQRSTUVWXYZ23456789); max 6.
	screen.Code = typed
}

// EnterCodeOnJoinPressed opens the join screen for that code. No backend call yet: the call
// happens on the next screen.
func EnterCodeOnJoinPressed(screen *EnterCodeState) {
	if len(screen.Code) == 6 {
		Navigate(JoinURL(screen.Code)) // -> routes.go -> SessionRouteView (view_session.go)
	}
}
