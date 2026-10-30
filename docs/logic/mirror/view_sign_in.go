// PSEUDOCODE — Go syntax, not compiled.
// VIEW: "/sign-in?next=…" — "Sign in or create your account". The definitive route for accounts
// (with Google as the only provider, signing in and registering are the same action). Reached from
// the top bar's corner, from the guest page, or for an operation that needs an account.
// code: apps/web/src/features/sign-in/SignInRoute.tsx
package mirror

func SignInView(next string) {
	// rule: already an account -> nothing to do here: ReplaceURL(next, or "/").
	if global.Auth.Status == "authenticated" {
		ReplaceURL(orHome(next))
		return
	}
	// rule: a guest is told that a new account keeps their name and games (the backend links it to
	//       the guest, who sent their access token with StartLogin), and that an account that
	//       already exists is entered instead, the guest's games staying behind.

	// "Continuar con Google" / "Continue with Google" is shown disabled, "coming soon": Google
	// sign-in arrives with the backend's provider.

	// When (development builds only): the person presses "Cuenta local de prueba" (the backend's
	// fictitious local provider).
	SignInOnProviderChosen("local", next)
	// rule: a failed start or completion shows its reason under the buttons: cancelled at the
	//       provider, provider not available here, rate limited (N seconds), unreachable, or
	//       "didn't finish, start again".
}

// SignInOnProviderChosen leaves the app for the provider. The verifier never leaves this tab.
// code: packages/features/sign-in/src/accountSignIn.ts#start
func SignInOnProviderChosen(provider string, next string) {
	verifier := randomVerifier()      // 32 random bytes, base64url
	challenge := s256(verifier)       // crypto.subtle, or SHA-256 in script over plain HTTP
	url, failure := StartLogin(provider, challenge) // external.go
	if failure != nil {
		return // the reason is shown on the page
	}
	// rule: kept in this tab's sessionStorage ("playhoot.pendingLogin.v1") until the provider
	//       sends the person back; another tab cannot complete it.
	savePendingLogin(PendingLogin{Verifier: verifier, Next: next, StartedAt: now()})
	LeaveTo(url) // the whole page goes to the provider
}

type PendingLogin struct {
	Verifier  string
	Next      string
	StartedAt int64
}

func randomVerifier() string            { return "" }
func s256(verifier string) string        { return "" }
func savePendingLogin(p PendingLogin)    {}
func takePendingLogin() *PendingLogin    { return nil } // returns it once and forgets it
func LeaveTo(url string)                 {}
func now() int64                         { return 0 } // Date.now()
