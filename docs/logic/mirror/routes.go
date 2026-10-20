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
		SessionRouteView(SessionTarget{Kind: "joinCode", JoinCode: param(url, "joinCode")}) // view_session.go

	case matches(url, "/sessions/{sessionUUID}/play"):
		SessionRouteView(SessionTarget{Kind: "session", SessionUUID: param(url, "sessionUUID")}) // view_session.go

	case url == "/design" && developmentBuild:
		// Living style guide: fake screens, no logic, no calls.

	default:
		NotFoundView() // view_not_found.go
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

func matches(url, pattern string) bool { return false }
func param(url, name string) string    { return "" }

var developmentBuild bool
