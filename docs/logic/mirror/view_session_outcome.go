// PSEUDOCODE — Go syntax, not compiled.
// SCREEN (inside the Session route): how the join ended — phase "closed".
// Title, sentence and buttons depend on the outcome (FLOWS.md §9 lists them all).
// code: apps/web/src/features/session-join/SessionScreen.tsx#OutcomeStep, outcomeCopy.ts
package mirror

func OutcomeScreen(join *JoinSession) {
	// When: the person presses "Intentar de nuevo" / "Try again" / "Tentar de novo" (lost connection,
	//       busy server, code not found...) or "Jugar aquí" / "Play here" / "Jogar aqui" (opened in another tab).
	OutcomeOnRetry(join)

	// When: the person presses "Ingresar un código" / "Enter a code" / "Digitar um código".
	OutcomeOnEnterAnotherCode()
}

// OutcomeOnRetry starts the same join again, on the same URL.
func OutcomeOnRetry(join *JoinSession) {
	join.Retry() // state_joinsession.go -> Start(): connect
}

// OutcomeOnEnterAnotherCode goes to Enter a code.
func OutcomeOnEnterAnotherCode() {
	Navigate(EnterCodeURL) // -> SessionRouteOnLeftRoute (feature discarded) -> EnterCodeView
}
