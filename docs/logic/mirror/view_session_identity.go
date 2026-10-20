// PSEUDOCODE — Go syntax, not compiled.
// SCREEN (inside the Session route): "What should we call you?" — phase "identity".
// Shown when the person has no identity yet (first visit, or after the stored one stopped working).
// code: apps/web/src/features/session-join/SessionScreen.tsx#IdentityStep
package mirror

// IdentityScreenState is this screen's own state.
type IdentityScreenState struct {
	Name string // what the person typed
}

func IdentityScreen(join *JoinSession) {
	screen := &IdentityScreenState{}

	// When: the person types in the field "Tu nombre" / "Your name" / "Seu nome".
	screen.Name = "Ana"

	// When: the person presses "¡A jugar!" / "Let's play" / "Bora jogar" (or Enter).
	IdentityOnSubmitted(join, screen)

	// When (development builds only): the person picks "Test user 1" / "Test user 2".
	IdentityOnDevAccountPicked(join, "test-user-2")
}

// IdentityOnSubmitted creates a guest with that name and joins.
func IdentityOnSubmitted(join *JoinSession, screen *IdentityScreenState) {
	join.SubmitDisplayName(screen.Name) // state_joinsession.go -> POST /v1/guests -> connect
	// Next screen: "connecting" on success, or this same screen with an error.
}

// IdentityOnDevAccountPicked signs in as one of the backend's fixed test accounts (the backend's
// placeholder identity treats every guest as the same user, so a second player needs one).
// code: apps/web/src/dev/DevIdentityPicker.tsx
func IdentityOnDevAccountPicked(join *JoinSession, token string) {
	SignIn(Credential{Token: token, Kind: "account" /* fixed userUUID and name per account */}) // state_app.go
	join.Retry()                                                                                // starts again: now there is an identity -> connect
}
