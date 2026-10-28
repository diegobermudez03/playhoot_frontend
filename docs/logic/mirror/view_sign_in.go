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
	// rule: a guest is warned that signing in with an account replaces that guest, and its games do
	//       not move to the account.

	// "Continuar con Google" / "Continue with Google" is shown disabled, "coming soon": Google
	// sign-in arrives with the backend's provider.

	// When (development builds only): the person picks "Test user 1" / "Test user 2".
	SignInOnDevAccountPicked("test-user-2")
}

// SignInOnDevAccountPicked signs in as one of the backend's fixed test accounts. Once signed in,
// the page itself continues to `next` (the rule at the top of SignInView).
// code: apps/web/src/dev/DevIdentityPicker.tsx
func SignInOnDevAccountPicked(token string) {
	SignIn(Credential{Token: token, Kind: "account" /* fixed userUUID and name per account */}) // state_app.go
}
