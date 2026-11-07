// PSEUDOCODE — Go syntax, not compiled.
// A game's draft in the workspace: the feature @playhoot/feature-game-authoring.
// code: packages/features/game-authoring/src/gameAuthoring.ts, pastedChange.ts
package mirror

type GameAuthoring struct {
	GameUUID string
	Load     string // loading | ready | failed(not-found | not-editable | unavailable)
	Draft    Draft  // the current revision with its files' content; kept when a later read fails
	// Revisions are the revisions read so far, newest first; nil until Historial asks for them.
	Revisions []Revision
	// OlderRevisions: older revisions than the last one read exist ("Ver revisiones anteriores").
	OlderRevisions bool
	// Comparison is the open comparison of two revisions: {from, to (nil: current), path?,
	// loading | ready(diff) | failed}; nil when none is open.
	Comparison *RevisionComparison
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
		a.LoadRevisions()
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
func (a *GameAuthoring) ApplyChange(change DraftChange) {
	ApplyChange(a.GameUUID, change, a.keyFor("change", change))
}
func (a *GameAuthoring) EditFile(path, content string) { /* ApplyChange on Draft.CurrentRevision with only that file */
}
func (a *GameAuthoring) Restore(revision int) {
	RestoreRevision(a.GameUUID, revision, a.Draft.CurrentRevision, a.keyFor("restore", revision))
}
func (a *GameAuthoring) UploadAsset(key string, file File) {
	UploadAsset(a.GameUUID, key, file, a.keyFor("upload", key))
}
func (a *GameAuthoring) RemoveAsset(key string) {
	RemoveAsset(a.GameUUID, key, a.keyFor("remove", key))
}
func (a *GameAuthoring) keyFor(action string, args any) string { return "" }

// ParsePastedChange reads pasted text strictly as data.
// rule: the whole text is the JSON envelope, or that JSON inside ONE code fence; text around it or
// two fences -> not-an-envelope; invalid JSON (often cut off) -> not-json, never repaired; another
// format -> wrong-format; base_revision not a whole number, files not [{path, content}], edits not
// [{path, find, replace, all?: boolean}] or delete not [paths] -> malformed(field); files, edits and
// delete may each be absent; a path written twice, or in more than one of files / edits / delete
// -> repeated-path (several edits of one path are fine).
// computes: the summary: added (written paths not in the draft), modified (written paths in it),
// edited (each edited path with its number of edits, in first-edit order), deleted.
func ParsePastedChange(text string, currentPaths []string) DraftChange { return DraftChange{} }

// ScenarioRunner is "Escenarios": runs a pasted scenario, a saved one or all of them, and reads
// one state of a kept result on demand.
// code: packages/features/game-authoring/src/scenarioRunner.ts
type ScenarioRunner struct {
	GameUUID string
	Run      string            // idle | running | done | failed
	Answer   *SimulationAnswer // single(result) | batch(scenarios)
	Failure  *GamesFailure
	// Inspection is the last state asked for: {resultID, atMs (nil: end), of, path, loading |
	// done(state) | failed}; a newer one, a new run or clearing replaces it.
	Inspection *StateInspection
}

// TemplateBrowser finds a template: featured and categories on load, a search (the newest wins),
// one inspected (the newest wins). An empty catalog is ready with nothing in it.
// code: packages/features/game-authoring/src/templateBrowser.ts
//
// GameAuthoring.UseTemplate(templateGameUUID) is an action like Restore: UseTemplate on the
// current revision with the action's key; template-not-found is its own result.

// SavedScenarioPaths are the draft's scenarios/*.json paths, sorted: the saved scenarios listed.
func SavedScenarioPaths(paths []string) []string { return nil }

// RunSaved runs the scenario saved at path (RunSimulation {scenario_path}); RunAll every saved one
// (RunSimulation {all: true}). Like Run, ignored while one runs.
func (r *ScenarioRunner) RunSaved(path string) {}
func (r *ScenarioRunner) RunAll()              {}

// Inspect reads one value of a kept result (ReadSimulationState).
// rule: an answer for an inspection no longer the last one is dropped.
func (r *ScenarioRunner) Inspect(resultID string, atMs *int, of, path string) {}

// ParsePastedScenario reads pasted text strictly as data, like ParsePastedChange: the JSON or it
// inside ONE code fence; its format must be playhoot.scenario.v1. The backend checks the rest.
func ParsePastedScenario(text string) any { return nil }

// Run sends the scenario (RunSimulation); a second run while one runs is ignored. Done keeps the
// result, Failed why not; leaving the section forgets both.
func (r *ScenarioRunner) Run(scenario any) {}

// GamePreview is "Probar juego": a private test game of the current revision's build that the
// creator plays as each synthetic participant in turn. It lives as long as the workspace, not the
// section: leaving "Probar juego" (to change the draft) keeps the test running, and coming back
// starts the game again on its current view.
// code: packages/features/game-authoring/src/preview.ts
type GamePreview struct {
	GameUUID string
	Phase    string // idle | starting | running | ended
	Players  int    // how many participants the next preview has (2 by default)
	// Range the game accepts, once the backend refused a number of players.
	Range *struct{ Min, Max int }
	// While running: the tested revision, the participants, who is played and whether paused.
	Revision     int
	Participants []string
	ActingAs     string
	Paused       bool
	// When ended: the backend's reason, a refusal, or the connection ending without one.
	Ended        string
	StartFailure string // build-not-ready | invalid-players | script-failure | busy | not-found | unavailable | ""
	// Notice is the last problem the backend reported while the preview goes on (it keeps
	// running): invalid-game-data (a SAMPLE or COMMAND the game does not declare; its command is
	// answered invalid), unknown-participant (act_as named none), or another code; with its detail.
	Notice *struct{ Kind, Detail string }
}

// DismissNotice hides the notice.
func (p *GamePreview) DismissNotice() {}

// Start opens a preview (CreatePreview; it ends the game's previous one) and connects to it
// (PreviewConnect). Running once the backend sends preview_started.
func (p *GamePreview) Start() {}

// ActAs plays as another participant: act_as is sent and, once the backend answers acting_as, the
// game runs anew for them. A game still shown for the previous participant can no longer act.
func (p *GamePreview) ActAs(participantID string) {}

// AiLinkSharing is "Compartir con mi IA": the game's link for the person's AI.
// code: packages/features/game-authoring/src/aiLink.ts
type AiLinkSharing struct {
	GameUUID string
	Load     string // loading | ready | failed
	Link     struct {
		Active    bool
		CreatedAt string
		ExpiresAt string
	}
	// Created is the link just made, shown once; only in memory, forgotten when the section closes,
	// on Revoke and on ForgetCreated. Never stored, never in the URL.
	Created *struct{ URL, ExpiresAt string }
	Busy    string // create | revoke | ""
	Failed  string // the last action that did not work: create | revoke | ""
}

func NewAiLinkSharing(gameUUID string) *AiLinkSharing { return &AiLinkSharing{GameUUID: gameUUID} }

// Load reads whether a link is active (ReadAiLink); a failure shows "try again".
func (s *AiLinkSharing) Load() {}

// Create makes a link (CreateAiLink), replacing the active one; on success Created holds it and
// Load runs again.
func (s *AiLinkSharing) Create() {}

// Revoke ends the active link (RevokeAiLink), forgets Created, and runs Load again.
func (s *AiLinkSharing) Revoke() {}

func (s *AiLinkSharing) ForgetCreated() { s.Created = nil }

// GameCard is what ReadCard answers: the card Game Management keeps for the game.
type GameCard struct {
	Name, Description string
	Logo              *CardImage
	Photos            []CardImage
	Visibility        string // public | private (may grow)
	Published         bool
	PublishedAt       *string
	Editing           bool // an edition is open: the draft can change
	Publishing        bool // a publication is under way
	Live              *LivePublication
}

// LivePublication is the publication players get: the latest completed release.
type LivePublication struct {
	ReleaseSequence, Revision int
	VersionUUID, PublishedAt  string
}

// CardImage is one card image; URL is a signed read valid a few minutes.
type CardImage struct{ UUID, MIMEType, URL string }

// Publication is what Publish answers.
type Publication struct {
	ReleaseUUID, VersionUUID, Visibility string
	Sequence, Revision                   int
}

// LoadRevisions reads the newest page of the history.
func (a *GameAuthoring) LoadRevisions() {
	page, failure := ListRevisions(a.GameUUID, nil) // external.go
	if failure != nil {
		return
	}
	a.Revisions = page
	a.OlderRevisions = hasOlder(page)
}

// LoadOlderRevisions reads the next page, below the oldest revision read.
func (a *GameAuthoring) LoadOlderRevisions() {
	read := a.Revisions
	if len(read) == 0 {
		return
	}
	oldest := read[len(read)-1].Number
	page, failure := ListRevisions(a.GameUUID, &oldest) // external.go
	// rule: a newer read of the first page replaced the list meanwhile -> this page is dropped.
	if failure != nil || !same(a.Revisions, read) {
		return
	}
	a.Revisions = append(read, page...)
	a.OlderRevisions = hasOlder(page)
}

// rule: a full page (100) not ending at revision 1 may have older revisions after it.
func hasOlder(page []Revision) bool {
	return len(page) == 100 && page[len(page)-1].Number != 1
}

// Compare opens the comparison of revision from with to (nil: the current one), only path when
// given ("Ver cambios": from the revision's parent, 0 for revision 1; "Comparar con la actual":
// from the revision to the current one; "Ver solo este archivo" on an omitted file).
func (a *GameAuthoring) Compare(from int, to *int, path *string) {
	opened := &RevisionComparison{From: from, To: to, Path: path, Status: "loading"}
	a.Comparison = opened
	diff, failure := DiffRevisions(a.GameUUID, from, to, path) // external.go
	// rule: a newer comparison, or closing it, replaced this one meanwhile -> the answer is dropped.
	if a.Comparison != opened {
		return
	}
	if failure != nil {
		a.Comparison.Status = "failed"
		return
	}
	a.Comparison.Status, a.Comparison.Diff = "ready", &diff
}

// CloseComparison closes it ("Cerrar"); no call.
func (a *GameAuthoring) CloseComparison() { a.Comparison = nil }
