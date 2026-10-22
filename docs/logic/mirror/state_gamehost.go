// PSEUDOCODE — Go syntax, not compiled.
// STATE: the GameHost — one game artifact running for one player, isolated, talking to the
// Session only through the Host. Started by Session Play (state_sessionplay.go) on the game screen,
// and by the dev lab /dev/game-host against a fake Session.
//
// The game is UNTRUSTED code. It runs in a sandboxed iframe with no network, no storage and no
// access to this page. It never sees the token, the WebSocket, the signed URL, command tokens or
// connection sample numbers. Bridge contract: ADR-0005.
//
// code: packages/game-host/src/gameHost.ts, packages/game-host/src/artifact.ts,
//       apps/web/src/platform/iframeGameContainer.ts, apps/web/src/platform/browserArtifactCache.ts
package mirror

type GameHost struct {
	Phase string // "loading" -> "starting" -> "running" | "failed"; "disposed" at the end
	Error *GameHostError

	Container *IframeContainer // the sandboxed iframe, while starting/running
	Acks      AckTranslator    // game sample ids <-> connection sample sequences
}

type GameHostError struct {
	Kind string // "artifact-unreachable" | "artifact-hash-mismatch" | "ready-timeout"
	//             "unsupported-bridge-version" | "container-violation" (the game navigated its frame)
}

// What the Host needs from the player's live connection: Join's Live link (state_joinsession.go).
type GameSessionPort interface {
	CurrentView() (state any, ack int, ok bool)
	Sample(inputs map[string]any)
	Command(name string, payload map[string]any) CommandResult
}

// GameContext is all the game is told about the player.
type GameContext struct {
	ParticipantID string   // "P1".."Pn", never the user id
	Participants  []string // participant ids
	Locale        string   // the platform UI language
}

// StartGameHost runs the artifact named by "session_started".frontend.
// code: packages/game-host/src/gameHost.ts#startGameHost
func StartGameHost(artifact struct{ URL, SHA256 string }, viewport Viewport, session GameSessionPort, context GameContext) *GameHost {
	h := &GameHost{Phase: "loading"}

	html, err := LoadArtifact(artifact.URL, artifact.SHA256)
	if err != nil {
		h.Fail(err.Kind) // "artifact-unreachable" | "artifact-hash-mismatch"
		return h
	}
	// metric: artifact-load-ms

	h.Phase = "starting"
	// rule: the iframe has sandbox="allow-scripts" only -> its origin is "null": no cookies, no
	//       storage, no access to this page. The HTML is parsed and a Content-Security-Policy is put
	//       first in its head: no network at all (no fetch/WebSocket, no external images/media/fonts),
	//       no forms, no <base>.
	// rule: messages are accepted only from that iframe's window; a second "load" of the iframe means
	//       the game navigated away -> Fail("container-violation"). The page itself allows no frame
	//       to navigate anywhere (frame-src 'none'), so the navigation never leaves the browser.
	// rule: before the game's HTML runs, nested frames (iframe, frame, object, embed...) and
	//       declarative shadow roots are removed from it, and a guard script runs first: it removes
	//       WebRTC from the game's window and removes any frame the game inserts later (also inside
	//       shadow roots) -> Fail("container-violation"). Best effort (ADR-0006).
	// rule: fixed-aspect viewport (plan §8). The iframe is always viewport.Width x viewport.Height
	//       (e.g. 1920 x 1080) and is scaled to fit the game area, centered, never stretched:
	//         scale = min(areaWidth / viewport.Width, areaHeight / viewport.Height)
	//       The space left becomes bars above/below or at the sides. Whenever the game area changes
	//       size (window resize, rotation), only the scale and the centering change; the game keeps
	//       seeing the same size, and touches/clicks reach it in those logical units.
	h.Container = OpenIframe(html, viewport)

	// rule: no "ready" within 10 s -> Fail("ready-timeout").
	// -> the game's SDK sends "ready" with the bridge versions it speaks -> h.OnGameReady
	return h
}

// LoadArtifact gets the game's HTML, byte-exact with what the backend pinned.
// code: packages/game-host/src/artifact.ts#createArtifactLoader
func LoadArtifact(url, sha256 string) (string, *GameHostError) {
	// 1. Browser Cache Storage "playhoot-game-artifacts-v1", key = sha256. If there, re-check its
	//    hash and use it (no network). This is what makes a refresh or a reconnect after the signed
	//    URL expired (15 min) still work.
	// 2. Otherwise FetchGameArtifact(url) (external.go), without cookies.
	//    network error / CORS / HTTP error (an expired URL answers 4xx) -> "artifact-unreachable"
	// 3. rule: SHA-256 of the bytes != sha256 -> "artifact-hash-mismatch" (nothing is run)
	// 4. Store in the cache by hash; return the HTML.
	return "", nil
}

// OnGameReady: the game said "ready".
func (h *GameHost) OnGameReady(offeredVersions []int) {
	// rule: a second "ready" is refused (recorded as bridge-rejected).
	// rule: pick the newest bridge version both speak; none -> send "incompatible" and
	//       Fail("unsupported-bridge-version").
	h.Phase = "running"
	// metric: ready-ms
	// Send to game: "start" {version, context, projection: the current view (full) or null}
	// From now on, every view/sample-sent of the connection -> h.OnSessionEvent
}

// OnSessionEvent forwards what the backend produced for this player.
func (h *GameHost) OnSessionEvent(e any) {
	// open                   -> a NEW connection (after a reconnection): h.Acks forgets the old
	//                           sequences (they restart at 1), and the game's last inputs are sent
	//                           again with the next FULL view (the backend reset them when the old
	//                           connection dropped; plan §13.7). That FULL view reaches the game as a
	//                           new baseline (full = true).
	// sample-sent(sequence)  -> h.Acks remembers which game sample that sequence carried
	// view(state)            -> send "update" {projection: {state, full, ack}, ack, events, errors}
	// view(ack only / gap)   -> send "update" {ack, events, errors} (no projection)
	// rule: ack is translated to the game's own sample id; the game never sees sequences.
	// rule: state is the WHOLE current state (patches already applied by the connection).
}

// OnGameMessage handles what the game posts (ADR-0005, ADR-0006).
// rule: rates first, before reading the message (packages/game-host/src/bridgeGuard.ts):
//       every message 240/s and 14,400/min; "sample" 120/s and 7,200/min; "command" and
//       "request_asset" 20/s and 300/min each. Over a limit -> dropped and counted by kind (the
//       first of each second is recorded as bridge-rejected).
// rule: messages dropped in each of 5 seconds in a row -> Fail("bridge-abuse").
// Then every message is validated:
// rule: exact shape (unknown fields refused), at most 32 KiB, nothing but "ready" before "running".
// A refused message is recorded (bridge-rejected) and dropped; the game keeps running.
func (h *GameHost) OnGameMessage(m any, session GameSessionPort) {
	// "sample" {id, inputs}
	//     rule: id must grow (the game's own numbering) -> remembered as the last inputs
	//     -> session.Sample(inputs)
	// "command" {id, name, payload}
	//     rule: 16 commands already waiting -> answer "unavailable" without running it (counts as
	//           a dropped message)
	//     -> session.Command(name, payload) (the connection makes and hides the idempotency token)
	//     -> send "command_result" {id, outcome, response}
	//        outcome: executed (also already_processed) | rejected (invalid, too large)
	//                 | unavailable (not running, connection closed, rate limited)
	// "request_asset" {id, key}
	//     rule: 8 already waiting -> answer found = false (counts as a dropped message)
	//     -> AssetResolver(key): bytes + mime type, or none (no asset source exists outside the dev
	//        lab until the backend stores assets) -> send "asset" {id, key, found, mimeType, bytes}
}

// Fail stops everything, tells the backend and keeps the reason.
func (h *GameHost) Fail(kind string) {
	h.Dispose()
	// -> SendGameFault (external.go) with the kind and its evidence: the failure's own facts (texts
	//    cut to 200 characters) and the messages dropped so far by kind. Never the artifact URL.
	//    Shown to the player as before: "bridge-abuse" is "the game has a problem".
	h.Phase = "failed"
	h.Error = &GameHostError{Kind: kind}
}

// Dispose closes the iframe, removes its listener and stops listening to the connection. The
// connection itself is not touched: it belongs to whoever started the GameHost.
func (h *GameHost) Dispose() { h.Phase = "disposed" }

type IframeContainer struct{}
type AckTranslator struct{}

func OpenIframe(html string, viewport Viewport) *IframeContainer { return &IframeContainer{} }
