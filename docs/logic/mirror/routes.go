// PSEUDOCODE — Go syntax, not compiled.
//
// ╔══════════════════════════════════════════════════════════════════════╗
// ║  START HERE. Every URL the app can show, and the view it runs.        ║
// ║  Navigating = calling Router with the new URL, so you can keep         ║
// ║  following the trail from any event to the next screen.               ║
// ╚══════════════════════════════════════════════════════════════════════╝
//
// How the mirror is layered:
//
//	routes.go          URL -> view function                           (you are here)
//	view_*.go          one view per screen: the events that can happen there,
//	                   each with a comment saying WHEN it happens
//	state_*.go         what those events do to state (global, feature, connection)
//	external.go        the calls to the backend (endpoints and DTOs)
//
// code: apps/web/src/app/router.tsx, apps/web/src/features/paths.ts
package mirror

// AppStart runs once when the page loads (any URL, including a refresh or a shared link).
// code: apps/web/src/main.tsx, apps/web/src/app/services.ts#startServices
func AppStart(url string) {
	// Reads the stored identity and language into the global state (no network call).
	Bootstrap() // state_app.go
	// Asks the backend which level each operation requires (retried until it answers).
	LoadOperations() // state_app.go

	Router(url)
}

// Router shows the view of a URL. Every page also has the top bar: AppShellView (view_app_shell.go).
func Router(url string) {
	switch {
	case url == "/":
		// No home page yet (it comes late): only a redirect, replacing the URL.
		ReplaceURL(EnterCodeURL)

	case url == EnterCodeURL:
		EnterCodeView() // view_enter_code.go

	case matches(url, "/join/{joinCode}"):
		RequireOperation("JOIN_SESSION_AS_PLAYER", url, func() {
			SessionRouteView(SessionTarget{Kind: "joinCode", JoinCode: param(url, "joinCode")}) // view_session.go
		})

	case matches(url, "/sessions/{sessionUUID}/play"):
		RequireOperation("JOIN_SESSION_AS_PLAYER", url, func() {
			SessionRouteView(SessionTarget{Kind: "session", SessionUUID: param(url, "sessionUUID")}) // view_session.go
		})

	case matches(url, "/sign-in/guest?next={next}"):
		GuestSignInView(safeNext(url)) // view_sign_in_guest.go

	case matches(url, "/sign-in?next={next}"):
		SignInView(safeNext(url)) // view_sign_in.go

	case url == "/design" && developmentBuild:
		// Living style guide: fake screens, no logic, no calls.

	case url == "/dev/game-host" && developmentBuild:
		// GameHost lab: StartGameHost (state_gamehost.go) with the built Space Drift fixture
		// (/__fixtures/games/space-drift/, served by the dev server) and a FAKE local Session.
		// No backend calls.

	default:
		NotFoundView() // view_not_found.go
	}
}

// RequireOperation shows a route only once the person may perform its operation, per the backend's
// catalog; otherwise it sends them to authenticate and back to this same URL afterwards.
// rule: the most flexible authentication the operation allows: the guest page (which also offers
//       an account) when it allows guests, the sign-in page when it needs an account.
// rule: while the identity or the catalog is not known yet, an empty page (no redirect).
// UX only: the backend still decides every request.
// code: apps/web/src/features/access.tsx#RequireOperation
func RequireOperation(operation string, url string, show func()) {
	switch access := OperationAccess(operation); access.Status { // state_app.go
	case "pending":
		// empty page until both are known
	case "allowed":
		show()
	case "needs":
		if access.Level == "guest" {
			ReplaceURL(GuestSignInURL(url))
		} else {
			ReplaceURL(SignInURL(url))
		}
	}
}

// Navigate goes to a URL adding a browser history entry ("back" returns here).
func Navigate(url string) { Router(url) }

// ReplaceURL changes the URL without a new history entry ("back" skips the old URL).
func ReplaceURL(url string) { Router(url) }

// URLs are built only here, from backend identifiers; the backend never sends URLs (ADR-0002).
const EnterCodeURL = "/join"

func JoinURL(joinCode string) string           { return "/join/" + joinCode }
func SessionPlayURL(sessionUUID string) string { return "/sessions/" + sessionUUID + "/play" }
func SignInURL(next string) string             { return "/sign-in?next=" + urlEncode(next) }
func GuestSignInURL(next string) string        { return "/sign-in/guest?next=" + urlEncode(next) }

// safeNext reads `next` from a sign-in URL. rule: only a path of this app ("/..."), never "//..."
// or another site, so a crafted link cannot send someone away after signing in; else "".
// code: apps/web/src/features/paths.ts#safeNext
func safeNext(url string) string { return "" }

func matches(url, pattern string) bool { return false }
func param(url, name string) string    { return "" }
func urlEncode(s string) string        { return s }

var developmentBuild bool
