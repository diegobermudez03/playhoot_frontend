// PSEUDOCODE — Go syntax, not compiled.
// The creator's game: creating it, then its workspace.
// code: apps/web/src/features/game-authoring/
package mirror

// CreateGameView is /games/new: creates the game and moves to its workspace.
// code: apps/web/src/features/game-authoring/CreateGameRoute.tsx
func CreateGameView() {
	key := NewUUID()                    // one per visit: a retry or React's double effect creates one game
	created, failure := CreateGame(key) // external.go
	if failure != nil {
		// shows "No pudimos crear tu juego" with **Intentar de nuevo** (same key)
		return
	}
	ReplaceURL("/games/" + created.GameUUID + "/edit") // going back does not create another
}

// GameWorkspaceView is /games/{id}/edit?section=…: the draft in six sections.
// code: apps/web/src/features/game-authoring/GameWorkspaceRoute.tsx
func GameWorkspaceView(gameUUID string, section string) {
	authoring := NewGameAuthoring(gameUUID) // state_gameauthoring.go, disposed when the route closes
	authoring.Reload()
	// rule: section is one of ai (default), files, assets, build, history, share; anything else is ai.
	// The header always shows the current revision and its build status.

	// WHEN a section is chosen ("Cambios de mi IA", "Archivos", "Recursos", "Construcción", "Historial")
	WorkspaceOnSectionChosen(section)
	// WHEN text is pasted in "Cambio de tu IA" and **Aplicar cambio** / Apply change is pressed
	WorkspaceOnApplyChange(authoring, "pasted text")
	// WHEN a file is edited and **Guardar como nueva revisión** / Save as a new revision is pressed
	WorkspaceOnSaveFile(authoring, "server/game.ts", "new content")
	// WHEN a file is chosen with **Subir** / **Reemplazar** (Upload / Replace)
	WorkspaceOnUploadAsset(authoring, "cardBack", File{})
	// WHEN **Quitar** / Remove is pressed on an asset
	WorkspaceOnRemoveAsset(authoring, "cardBack")
	// WHEN **Restaurar** / Restore is pressed on a revision
	WorkspaceOnRestore(authoring, 1)
	// WHEN **Recargar el juego** / Reload the game is pressed after a conflict
	authoring.Reload()

	// "Escenarios" (section scenarios): its own state, created when the section opens and forgotten
	// when it closes (state_gameauthoring.go ScenarioRunner).
	runner := &ScenarioRunner{GameUUID: gameUUID}
	// WHEN a scenario is pasted and **Ejecutar escenario** / Run scenario is pressed
	// (enabled only when the current revision's build succeeded)
	WorkspaceOnRunScenario(runner, "pasted text")
	// WHEN **Copiar resultado para mi IA** / Copy result for my AI is pressed
	WorkspaceOnCopyScenarioResult(runner)

	// "Compartir con mi IA" (section share): its own state, created when the section opens and
	// forgotten when it closes (state_gameauthoring.go AiLinkSharing).
	sharing := NewAiLinkSharing(gameUUID)
	sharing.Load()
	// WHEN **Crear enlace** is pressed, or **Renovar enlace** and then its confirmation
	WorkspaceOnCreateAiLink(sharing)
	// WHEN **Revocar enlace** is pressed and then its confirmation
	WorkspaceOnRevokeAiLink(sharing)
	// WHEN **Copiar mensaje para mi IA** / **Copiar solo el enlace** is pressed
	WorkspaceOnCopyAiLink(sharing, true)
}

// WorkspaceOnCreateAiLink makes the game's link for the person's AI. With one active, the page first
// says the old one will stop working and asks to confirm.
func WorkspaceOnCreateAiLink(sharing *AiLinkSharing) { sharing.Create() }

// WorkspaceOnRevokeAiLink asks once more, then revokes.
func WorkspaceOnRevokeAiLink(sharing *AiLinkSharing) { sharing.Revoke() }

// WorkspaceOnCopyAiLink copies the message for the AI chat with the link in it (withMessage), or
// the link alone; the clipboard refusing leaves the link on screen to copy by hand.
// rule: the message is "Read this link and help me with my Playhoot game: LINK" in the page's
// language.
func WorkspaceOnCopyAiLink(sharing *AiLinkSharing, withMessage bool) {}

func WorkspaceOnSectionChosen(section string) {
	ReplaceURL("?section=" + section) // the URL says which section is open; no call
}

func WorkspaceOnApplyChange(authoring *GameAuthoring, pasted string) {
	// computes: ParsePastedChange(pasted, the current paths) (state_gameauthoring.go). Refused text
	// shows why and disables the button; a valid change shows what it adds, changes and deletes, and
	// warns when its base revision is not the current one (the backend will answer a conflict).
	change := ParsePastedChange(pasted, authoring.Draft.Paths())
	authoring.ApplyChange(change) // -> the answer shows below; the box empties when applied or unchanged
}

func WorkspaceOnSaveFile(authoring *GameAuthoring, path, content string) {
	authoring.EditFile(path, content) // a change with only this file, on the current revision
}

func WorkspaceOnUploadAsset(authoring *GameAuthoring, key string, file File) {
	authoring.UploadAsset(key, file)
}

func WorkspaceOnRemoveAsset(authoring *GameAuthoring, key string) {
	authoring.RemoveAsset(key)
}

func WorkspaceOnRestore(authoring *GameAuthoring, revision int) {
	authoring.Restore(revision) // on the current revision as its base
}

// WorkspaceOnRunScenario reads the pasted scenario (ParsePastedScenario; refused locally with what
// is wrong) and runs it on the current revision's build.
func WorkspaceOnRunScenario(runner *ScenarioRunner, text string) {
	runner.Run(ParsePastedScenario(text))
}

// WorkspaceOnCopyScenarioResult copies the whole result as JSON (the exact answer, pretty-printed);
// the clipboard refusing leaves it on screen to copy by hand.
func WorkspaceOnCopyScenarioResult(runner *ScenarioRunner) {}
