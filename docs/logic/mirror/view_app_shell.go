// PSEUDOCODE — Go syntax, not compiled.
// VIEW: the top bar, present on every page (logo, sound button, language picker).
// code: apps/web/src/ui/AppShell.tsx
package mirror

func AppShellView() {
	// When: the person clicks the logo (every page except Enter a code, which shows a big logo instead).
	Navigate("/") // -> routes.go: "/" redirects to Enter a code for now

	// When: the person picks another language in the picker.
	AppShellOnLanguagePicked("es")

	// When: the person presses the speaker button.
	AppShellOnSoundToggled()
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
