# ADR-0006: Game isolation hardening, bridge limits and game fault reports

Status: ACCEPTED
Created: 2026-10-20
Last status change: 2026-10-21 (amended by the human: leaving after a suspicious stop; backend limit audit)
Supersedes: None
Superseded by: None

## Context

Plan step 9 (§16, §17) hardens the boundary between the untrusted game frontend and the Host. ADR-0005 left two known gaps: a game can navigate its own frame and carry data away in the URL, and nothing limits how fast a game posts messages to the Host.

Measured in headless Edge on 2026-10-20 (Edge 155):

- A `frame-src 'none'` policy on the embedding page still lets the game's `srcdoc` iframe load, and blocks the game's frame from navigating anywhere before any request leaves.
- Inside the sandboxed iframe, with `connect-src 'none'` and even `webrtc 'block'` in its CSP, `RTCPeerConnection` still gathers server-reflexive candidates from a public STUN server: WebRTC is a network exit CSP does not close in this browser.
- Deleting `RTCPeerConnection` from the game's window is not enough alone: a nested `srcdoc` frame created by the game has its own WebRTC and can receive data by `postMessage`. A nested `about:blank` frame is cross-origin to the game and gives it nothing.

What a game could leak is only the player's own view of the game, the participant ids and the UI language: never tokens, the signed URL or the connection.

The human decided on 2026-10-20: block WebRTC on a best-effort basis; stop a game that keeps abusing the bridge rather than only dropping its messages; and tell the backend about every stopped game so it can audit, from its database, games with problems and whether the game or the client was at fault. Weighing a public report endpoint (anyone could accuse a game falsely) against letting abusive traffic through to the backend, the human chose reports on the player's own live connection.

## Decision

**Navigation.** The web app page declares `frame-src 'none'` (`apps/web/index.html`): no frame may load or navigate anywhere. The game's `srcdoc` iframe is unaffected; a game navigating its frame is blocked and, as before, stopped as a container violation.

**Nested frames and WebRTC (best effort).** Before the game's HTML runs, the web container removes every nested frame element (`iframe`, `frame`, `frameset`, `object`, `embed`, `portal`, `fencedframe`) and declarative shadow roots from it, and puts a guard script right after the CSP, ahead of anything the game wrote. The guard deletes every `RTC*` constructor from the game's window, deletes `setHTMLUnsafe` / `Document.parseHTMLUnsafe`, and watches the document and every shadow root the game attaches: a frame the game inserts is removed before it loads and stops the game as a container violation. This raises the cost of leaking far above what a generated game does by accident; it is not airtight, and the residual risk is the player's own view.

**Bridge limits.** The Host counts every game message before decoding it, in one-second and one-minute windows (`bridgeRates` in `@playhoot/protocol/bridge`): all messages 240/s and 14,400/min; SAMPLE 120/s and 7,200/min (twice the backend's rate, for games sampling every frame on fast displays); COMMAND and asset requests 20/s and 300/min, like the backend's commands. At most 16 commands and 8 asset requests wait at once; one beyond is answered `unavailable` / not found without running. Dropped messages are counted by kind, and the first of each second is recorded as a refused message. A game with dropped messages in each of 5 consecutive seconds is stopped as `bridge-abuse` ("the game has a problem" for the player).

**Fault reports.** Whenever the GameHost stops a game (artifact unreachable, hash mismatch, no READY, no common bridge version, container violation, bridge abuse), it sends `game_fault` on the player's live connection with the kind and a small detail: the failure's own facts (texts cut to 200 characters) and the messages refused so far by kind, never the artifact URL. A detail over 2 KiB is replaced by `{ "truncated": true }`. The backend keeps it only from a current participant of the running game, in `play_game_faults` (one row per Session, reporter and kind, counted), and never acts on it by itself (backend `play/docs/FLOWS.md`, Game Fault Reports).

**Leaving after a suspicious stop** (amended 2026-10-21 by the human). A game stopped for abusing the bridge, a container violation or a hash mismatch is suspicious, not unlucky: after the report, the player leaves the Session (`leave` on the same connection, which the backend handles after the report, both sharing one lane), and sees "The game had a problem", without "Try again", which would run the same game again. A failure that may pass (download, no READY, bridge version) keeps "Try again" and the player in the Session.

**Backend limits are audited too** (2026-10-21, backend side). Every rate or resource limit the backend enforces on a live Session's user (message lanes, connection rates, the Runtime's limits) is also persisted, best effort, in the same audit table as `SERVER_LIMIT` records, so a client's report and the traffic the platform saw can be read side by side.

## Alternatives Considered

- **Accept the WebRTC exit and document it.** Rejected by the human: cheap blocking was preferred.
- **Drop abusive messages without ever stopping the game.** Rejected by the human: a game that keeps abusing is stopped.
- **Let abusive traffic reach the backend so it detects it there.** Rejected: most abuse never reaches the backend (SAMPLEs are coalesced, invalid messages are dropped locally), the device is not protected, and the backend could not tell an abusive game from a client sending the same traffic.
- **A public endpoint to report games.** Rejected: anyone could report any game. Reporting on the live connection limits a client to the game it is playing.

## Consequences

- The ADR-0005 gap about frame navigation is closed.
- WebRTC exfiltration is harder but not impossible (for example through browser features not yet known to the guard). The backend's audit table is the place where a misbehaving game shows up.
- A game that needs nested frames, WebRTC or more than these message rates does not work on Playhoot; raising a limit is a change to `bridgeRates` and this ADR.
- The guard depends on the web platform; a WebView host (mobile) needs its own equivalent.
- Fault reports depend on the live connection: a game that fails while the player is offline is not reported.

## Canonical Knowledge Impact

- `ARCHITECTURE.md` unchanged: the isolation invariants it states hold, now enforced more strictly.
- `docs/architecture/BACKEND_CONTRACT.md`: the `game_fault` player message and its limits.
- `docs/logic/`: the GameHost limits, the fault report as an external call.
- Backend repository: `play_game_faults`, `recordgamefault`, the `game_fault` message (its own docs).
