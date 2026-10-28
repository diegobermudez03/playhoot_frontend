// PSEUDOCODE — Go syntax, not compiled.
// VIEW: "/sign-in/guest?next=…" — "What should we call you?". Where a person without an identity is
// sent for an operation that allows guests (joining a game): the easiest way in, with the option to
// use an account instead. When the next URL is a join link, it says which game they are joining.
// code: apps/web/src/features/sign-in/GuestSignInRoute.tsx, packages/features/sign-in/src/guestSignIn.ts
package mirror

// GuestSignInState is this page's state (its own feature, thrown away when the page is left).
type GuestSignInState struct {
	Name       string // what the person typed
	Submitting bool   // waiting for POST /v1/guests
	Error      *IdentityError
	pendingKey struct{ Name, Key string }
}

type IdentityError struct {
	Kind              string // "invalid-name" | "rate-limited" | "unavailable"
	Reason            string // invalid-name: "empty" | "too-long" | "rejected"
	MaxLength         int    // 64
	RetryAfterSeconds int
}

func GuestSignInView(next string) {
	// rule: already a guest or an account -> nothing to do here: ReplaceURL(next, or "/").
	if global.Auth.Status == "guest" || global.Auth.Status == "authenticated" {
		ReplaceURL(orHome(next))
		return
	}
	page := &GuestSignInState{}

	// When: the person types in "Tu nombre" / "Your name" / "Seu nome".
	page.Name = "Ana"

	// When: the person presses "¡A jugar!" / "Let's play" / "Bora jogar" (or Enter).
	GuestSignInOnSubmitted(page)

	// When: the person follows "Inicia sesión o regístrate" / "Sign in or sign up" / "Entre ou cadastre-se".
	Navigate(SignInURL(next)) // view_sign_in.go, keeping where to continue
}

// GuestSignInOnSubmitted creates a guest with that name. Once signed in, the page itself continues
// to `next` (the rule at the top of GuestSignInView).
func GuestSignInOnSubmitted(page *GuestSignInState) {
	name := trim(page.Name)
	// rule: 1..64 characters, else Error{invalid-name, empty | too-long}; the backend is not called.

	// rule: same name submitted again -> same idempotency key, so a retry never creates two guests.
	if page.pendingKey.Name != name {
		page.pendingKey.Name, page.pendingKey.Key = name, newUUID()
	}
	page.Submitting = true

	guest, failure := CreateGuest(name, page.pendingKey.Key) // external.go: POST /v1/guests
	page.Submitting = false

	if failure != nil {
		// rule: 409 (the key is too old to be a retry) -> the key is dropped, the next try uses a new one.
		// rule: 400 -> invalid-name/rejected · code rate_limited -> rate-limited (+ seconds) · else unavailable.
		page.Error = &IdentityError{}
		return
	}
	// rule: an answer that arrives after the person left the page still signs them in, unless they
	//       signed into an account meanwhile (a guest never replaces an account).
	// rule: the name shown is the backend's form of it (trimmed, normalized).
	SignIn(guest) // state_app.go
}

func orHome(next string) string {
	if next == "" {
		return "/"
	}
	return next
}
