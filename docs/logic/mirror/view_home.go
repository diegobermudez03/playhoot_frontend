// PSEUDOCODE — Go syntax, not compiled.
// VIEW: Home — "/" — type a join code.
// code: apps/web/src/app/HomeRoute.tsx
package mirror

// HomeState is this screen's own state (component state: gone when the screen is left).
type HomeState struct {
	Code string // what the person typed so far
}

func HomeView() {
	home := &HomeState{}

	// When: the person types, deletes or pastes in the code tiles.
	HomeOnCodeTyped(home, "hoot4")

	// When: the person presses the button "Unirme" / "Join" / "Entrar" (enabled only with 6 characters).
	HomeOnJoinPressed(home)
}

// HomeOnCodeTyped keeps only valid code characters.
func HomeOnCodeTyped(home *HomeState, typed string) {
	// rule: uppercase; keep only the join-code alphabet (ABCDEFGHJKMNPQRSTUVWXYZ23456789); max 6.
	home.Code = typed
}

// HomeOnJoinPressed opens the join screen for that code. No backend call yet: the call
// happens on the next screen.
func HomeOnJoinPressed(home *HomeState) {
	if len(home.Code) == 6 {
		Navigate(JoinURL(home.Code)) // -> routes.go -> SessionRouteView (view_session.go)
	}
}
