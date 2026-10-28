// PSEUDOCODE — Go syntax, not compiled.
// VIEW: the top bar, present on every page (logo, sound button, language picker), except during a
// game on a "wide" display (immersive: no bar; the game screen has its own sound button).
// rule: layout (apps/web/src/features/layout.ts) = "wide" when the display is landscape and at least
//       600 px wide, else "compact". Presentation only: it changes how a screen is arranged, never
//       what it does, calls or where it navigates.
// code: apps/web/src/ui/AppShell.tsx
package mirror

func AppShellView() {
	// When: the person clicks the logo (every page except Enter a code, which shows a big logo instead).
	Navigate("/") // -> routes.go: "/" redirects to Enter a code for now

	// When: the person picks another language in the picker.
	AppShellOnLanguagePicked("es")

	// When: the person presses the speaker button.
	AppShellOnSoundToggled()

	// The corner (code: apps/web/src/app/AccountButton.tsx), by who the person is:
	// - nobody: a person icon ("Iniciar sesión" / "Sign in" / "Entrar" written out on wide screens);
	//   hidden on the sign-in pages themselves.
	// - a guest or an account: their initial; it opens a menu with their name ("Invitado" under it
	//   for a guest) and one action.
	// When: nobody presses the person icon, or a guest presses "Iniciar sesión" in the menu.
	Navigate(SignInURL(currentURL())) // view_sign_in.go; continues here afterwards
	// When: an account presses "Cerrar sesión" / "Sign out" / "Sair" in the menu.
	AppShellOnSignedOut()
}

// AppShellOnSignedOut forgets the account. If the current page needs an identity (a game), the page
// then sends the person to authenticate and back (routes.go#RequireOperation).
func AppShellOnSignedOut() {
	SignOut() // state_app.go
}

// AppShellOnLanguagePicked: every text on screen switches at once. No call, no navigation.
// code: apps/web/src/i18n/LanguagePicker.tsx
func AppShellOnLanguagePicked(locale string) {
	SetLocale(locale) // state_app.go: global state + browser storage
}

// AppShellOnSoundToggled mutes or unmutes every sound and the music.
// code: apps/web/src/sound/SoundToggle.tsx
func AppShellOnSoundToggled() {
	// Flips the mute flag and saves it in browser storage ("playhoot.sound.v1" = on|off).
	// Presentation preference only: not in the global state, no call, no navigation.
}
