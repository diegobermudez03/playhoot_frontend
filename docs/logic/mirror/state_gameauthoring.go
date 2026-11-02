// PSEUDOCODE — Go syntax, not compiled.
// A game's draft in the workspace: the feature @playhoot/feature-game-authoring.
// code: packages/features/game-authoring/src/gameAuthoring.ts, pastedChange.ts
package mirror

type GameAuthoring struct {
	GameUUID string
	Load     string // loading | ready | failed(not-found | not-editable | unavailable)
	Draft    Draft  // the current revision with its files' content; kept when a later read fails
	// Revisions is every revision, oldest first; nil until Historial asks for it.
	Revisions []Revision
	Busy      string        // the action in progress: change | edit | restore | upload | remove; one at a time
	Result    *ActionResult // how the last action ended: applied(revision) | unchanged | conflict |
	// invalid(diagnostics) | too-large(diagnostics) | not-declared | not-editable |
	// busy(retryAfterSeconds) | failed

	// pendingKey is the idempotency key of the last action that did not succeed: retrying the same
	// action (same kind and arguments) sends it again; any other action takes a new key.
	pendingKey struct{ Fingerprint, Key string }
}

func (a *GameAuthoring) Reload() {
	draft, failure := ReadDraft(a.GameUUID) // external.go
	if failure != nil {
		// rule: only a first read fails the page; a draft already shown stays.
		return
	}
	a.Draft = draft
	if a.Revisions != nil {
		a.Revisions, _ = ListRevisions(a.GameUUID)
	}
	if draft.Build.Status == "QUEUED" || draft.Build.Status == "RUNNING" {
		a.followBuild(draft.CurrentRevision)
	}
}

// followBuild waits for the build of revision through the backend's long poll, then reads the
// draft again. rule: a newer Reload stops an older follow; up to 5 failed reads, 3 s apart.
func (a *GameAuthoring) followBuild(revision int) {
	for {
		build, failure := ReadBuild(a.GameUUID, revision, 20) // external.go
		if failure != nil {
			Wait(3 * Second)
			continue
		}
		a.Draft.Build = build
		if build.Status != "QUEUED" && build.Status != "RUNNING" { // unknown statuses end the follow
			a.Reload()
			return
		}
	}
}

// Every action: Busy = action; send with the key; Result = the answer; a new revision -> Reload.
func (a *GameAuthoring) ApplyChange(change DraftChange)       { ApplyChange(a.GameUUID, change, a.keyFor("change", change)) }
func (a *GameAuthoring) EditFile(path, content string)        { /* ApplyChange on Draft.CurrentRevision with only that file */ }
func (a *GameAuthoring) Restore(revision int)                 { RestoreRevision(a.GameUUID, revision, a.Draft.CurrentRevision, a.keyFor("restore", revision)) }
func (a *GameAuthoring) UploadAsset(key string, file File)    { UploadAsset(a.GameUUID, key, file, a.keyFor("upload", key)) }
func (a *GameAuthoring) RemoveAsset(key string)               { RemoveAsset(a.GameUUID, key, a.keyFor("remove", key)) }
func (a *GameAuthoring) keyFor(action string, args any) string { return "" }

// ParsePastedChange reads pasted text strictly as data.
// rule: the whole text is the JSON envelope, or that JSON inside ONE code fence; text around it or
// two fences -> not-an-envelope; invalid JSON (often cut off) -> not-json, never repaired; another
// format -> wrong-format; base_revision not a whole number, files not [{path, content}] or delete
// not [paths] -> malformed(field); a path twice -> repeated-path.
// computes: the summary: added (paths not in the draft), modified (paths in it), deleted.
func ParsePastedChange(text string, currentPaths []string) DraftChange { return DraftChange{} }
