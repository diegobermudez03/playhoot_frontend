// PSEUDOCODE — Go syntax, not compiled.
// The creator's game: creating it, then its workspace.
// code: apps/web/src/features/game-authoring/
package mirror

// CreateGameView is /games/new: creates the game and moves to its workspace.
// code: apps/web/src/features/game-authoring/CreateGameRoute.tsx
func CreateGameView() {
	key := NewUUID() // one per visit: a retry or React's double effect creates one game
	created, failure := CreateGame(key) // external.go
	if failure != nil {
		// shows "No pudimos crear tu juego" with **Intentar de nuevo** (same key)
		return
	}
	ReplaceURL("/games/" + created.GameUUID + "/edit") // going back does not create another
}

// GameWorkspaceView is /games/{id}/edit?section=…: the draft in five sections.
// code: apps/web/src/features/game-authoring/GameWorkspaceRoute.tsx
func GameWorkspaceView(gameUUID string, section string) {
	authoring := NewGameAuthoring(gameUUID) // state_gameauthoring.go, disposed when the route closes
	authoring.Reload()
	// rule: section is one of ai (default), files, assets, build, history; anything else is ai.
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
}

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
