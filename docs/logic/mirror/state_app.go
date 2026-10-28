// PSEUDOCODE — Go syntax, not compiled.
// STATE: the GLOBAL state — what every screen can read. Only what is truly global lives here;
// each feature's own state lives with the feature and is thrown away when its route is left
// (state_joinsession.go).
package mirror

// AppGlobalState is the whole global state.
// code: packages/app-core/src/appState.ts#AppGlobalState
type AppGlobalState struct {
	Auth       AuthSnapshot
	Operations OperationCatalog
	Locale     string // "es" | "en" | "pt-BR"
}

// OperationCatalog is the backend's list of operations and the minimum level each requires.
// code: packages/app-core/src/access.ts#OperationCatalog
type OperationCatalog struct {
	Status       string            // "loading" | "ready"
	Requirements map[string]string // operation -> "anonymous" | "guest" | "account" (or a level this code does not know)
}

// AuthSnapshot is who the app acts as. It drives UX only: it never grants anything, and a
// backend 401/403 wins over it.
// code: packages/app-core/src/auth.ts#AuthSnapshot
type AuthSnapshot struct {
	Status      string // "unknown" (before bootstrap) | "none" | "guest" | "authenticated"
	UserUUID    string // when guest/authenticated
	DisplayName string // the name chosen locally; the backend stores no names yet
}

// Credential is what is persisted to keep acting as someone. Only Token is ever sent.
// Persisted in the browser's localStorage under "playhoot.credential.v1".
// code: packages/app-core/src/credentials.ts#Credential
type Credential struct {
	Token       string
	UserUUID    string
	Kind        string // "guest" | "account"
	DisplayName string
}

var global AppGlobalState // starts as {Auth: {Status: "unknown"}, Locale: "en"}
var credential *Credential // in memory; the source of the token for every call

// Bootstrap runs once when the page loads, before anything renders.
// code: apps/web/src/app/services.ts#startServices -> packages/app-core/src/appState.ts#bootstrap
func Bootstrap() {
	credential = loadFromBrowser("playhoot.credential.v1") // nil if absent, corrupt or storage blocked
	global.Auth = snapshotOf(credential)

	saved := loadFromBrowser("playhoot.locale.v1")
	if isSupported(saved) {
		global.Locale = saved
	} else {
		// rule: first of the device's languages that we support, matching the exact tag first and
		// then the language alone (pt-PT -> pt-BR, es-CO -> es); otherwise "en".
		global.Locale = resolveLocale(deviceLanguages())
	}
	// Also starts watching device capabilities (screen size, orientation, pointer, gamepad) into
	// their own small store; nothing reads them for logic yet.
}

// LoadOperations reads the backend's operation catalog once per page load.
// rule: while the backend cannot be reached it is asked again after 1, 2, 4... seconds (at most
//       30); routes that need it show an empty page meanwhile (routes.go#RequireOperation).
// code: apps/web/src/app/services.ts#loadOperations
func LoadOperations() {
	operations, failure := ListOperations() // external.go: GET /v1/identity/operations
	if failure != nil {
		return // asked again later (see rule)
	}
	global.Operations = OperationCatalog{Status: "ready", Requirements: operations}
}

// OperationAccess says whether the person may go ahead with an operation, from the identity and the
// catalog. UX only: the backend still decides.
// rule: the person's level: none -> "anonymous", guest -> "guest", authenticated -> "account".
// rule: an operation missing from the catalog, or a level this code does not know, requires "account".
// rule: allowed when the person's level is at least the required one; otherwise "needs" that level
//       (a guest when the operation allows guests).
// code: packages/app-core/src/access.ts#operationAccess
func OperationAccess(operation string) struct{ Status, Level string } {
	return struct{ Status, Level string }{} // "pending" | "allowed" | "needs" (+ Level "guest" | "account")
}

// SignIn adopts a new identity (after creating a guest, or the dev test-account picker).
// code: packages/app-core/src/appState.ts#signIn
func SignIn(c Credential) {
	saveToBrowser("playhoot.credential.v1", c)
	credential = &c
	global.Auth = snapshotOf(credential)
}

// SignOut forgets the identity. Called when any HTTP call gets 401 token_invalid, and by the
// account menu's sign out. A route that needs an identity then sends the person to sign in.
// code: packages/app-core/src/appState.ts#signOut
func SignOut() {
	removeFromBrowser("playhoot.credential.v1")
	credential = nil
	global.Auth = AuthSnapshot{Status: "none"}
}

// SetLocale is the language picker in the top bar.
// code: packages/app-core/src/appState.ts#setLocale
func SetLocale(locale string) {
	saveToBrowser("playhoot.locale.v1", locale)
	global.Locale = locale // every text on screen switches immediately
}

// Sound mute is a per-browser preference outside the global state (presentation only):
// saved as "playhoot.sound.v1" = "on" | "off", default on. code: apps/web/src/platform/browserSoundPreference.ts

func snapshotOf(c *Credential) AuthSnapshot {
	if c == nil {
		return AuthSnapshot{Status: "none"}
	}
	status := "authenticated"
	if c.Kind == "guest" {
		status = "guest"
	}
	return AuthSnapshot{Status: status, UserUUID: c.UserUUID, DisplayName: c.DisplayName}
}

func loadFromBrowser(key string) *Credential   { return nil } // localStorage read, validated
func saveToBrowser(key string, value any)       {}             // localStorage write (ignored if blocked)
func removeFromBrowser(key string)              {}
func isSupported(locale any) bool               { return false }
func resolveLocale(preferences []string) string { return "en" }
func deviceLanguages() []string                 { return nil } // navigator.languages
