// PSEUDOCODE — Go syntax, not compiled.
// VIEW: "/sign-in/complete?code=…" (or "?error=cancelled|failed|unavailable") — where the provider
// sends the person back after an account sign-in (the backend's callback redirects here).
// code: apps/web/src/features/sign-in/SignInCompleteRoute.tsx
package mirror

// CaptureSignInCompletion runs first at page load, before anything renders or loads: the one-time
// code must never leave this browser, so it is read and removed from the URL at once.
// code: apps/web/src/platform/signInCompletion.ts, called from apps/web/src/main.tsx
func CaptureSignInCompletion(url string) {
	if path(url) != "/sign-in/complete" {
		return
	}
	captured = &LoginCompletion{Code: query(url, "code"), Error: query(url, "error")}
	ReplaceURL("/sign-in/complete") // history.replaceState: no query left
}

type LoginCompletion struct{ Code, Error string }

var captured *LoginCompletion

func SignInCompleteView() {
	// rule: opened without the provider sending anyone here -> ReplaceURL("/").
	if captured == nil {
		ReplaceURL("/")
		return
	}
	// Shows "Iniciando sesión…" while it completes; runs once per page load.
	SignInComplete(*captured)
}

// SignInComplete exchanges the code for the account's credentials.
// code: packages/features/sign-in/src/accountSignIn.ts#complete
func SignInComplete(completion LoginCompletion) {
	pending := takePendingLogin() // view_sign_in.go
	// rule: ?error=cancelled -> "You cancelled" · unavailable -> "couldn't reach" · else "didn't
	//       finish, start again"; nothing changes: a guest stays that guest.
	// rule: no code, no pending sign-in in this tab, or one older than 10 minutes -> failed.
	if completion.Error != "" || completion.Code == "" || pending == nil {
		return // the failure and a "Back to sign in" button are shown
	}
	// rule: the identity in use (a guest) is handed over so the backend ends its session.
	replaces := credential.RefreshToken // state_app.go; empty for nobody
	account, failure := CompleteLogin(completion.Code, pending.Verifier, replaces) // external.go
	if failure != nil {
		return // network / 5xx -> "couldn't reach"; anything else -> "didn't finish, start again"
	}
	SignIn(account)                 // state_app.go
	ReplaceURL(orHome(pending.Next)) // continues where the sign-in was started from
}

func path(url string) string            { return "" }
func query(url, name string) string     { return "" }
