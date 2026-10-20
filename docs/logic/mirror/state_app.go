// PSEUDOCODE — Go syntax, not compiled.
// STATE: the GLOBAL state — what every screen can read. Only what is truly global lives here;
// each feature's own state lives with the feature and is thrown away when its route is left
// (state_joinsession.go).
package mirror

// AppGlobalState is the whole global state.
// code: packages/app-core/src/appState.ts#AppGlobalState
type AppGlobalState struct {
	Auth   AuthSnapshot
	Locale string // "es" | "en" | "pt-BR"
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

// SignIn adopts a new identity (after creating a guest, or the dev test-account picker).
// code: packages/app-core/src/appState.ts#signIn
func SignIn(c Credential) {
	saveToBrowser("playhoot.credential.v1", c)
	credential = &c
	global.Auth = snapshotOf(credential)
}

// SignOut forgets the identity. Called when any HTTP call gets 401 token_invalid.
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
