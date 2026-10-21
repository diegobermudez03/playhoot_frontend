# @playhoot/feature-session-play

Session Play feature (logical state and ports).

Status: IMPLEMENTED (plan step 6): `createSessionPlay` runs the started game through the GameHost on the player's live connection; verified end to end against the real backend. Repository-wide implementation state: `CURRENT_STATE.md` at the root.

## Owns

The running game for one player (plan §12, §13.3-§13.8): `createSessionPlay(start, locale, deps)` with `attach(container)` (starts the GameHost in the presentation's game area, returns a detach), `reload()` (after a failure) and `dispose()`. Its store has the GameHost status (loading, starting, running, failed with a typed reason, disposed) and how many game messages the Host refused. It reports load and READY times, refusals and failures to an optional telemetry sink (`onTelemetry`; the web app prints them in development).

The plan's `SessionPlayState` is split on purpose between two features, because the connection already lives in Join Session and a refresh or reconnection must not recreate the game:

| Plan's SessionPlayState item | Where |
| --- | --- |
| lifecycle (lobby / running / terminal), session identity and role, artifact metadata | Join Session (`phase`, `session` with participant, roster and frontend) |
| connection (connecting / connected / reconnecting / disconnected) | Join Session (`phase: 'connecting'`, and `connection` while `started`) |
| current projection and its baseline/revision | the connection (`currentView`), reached through Join's `live` link |
| GameHost readiness, platform errors of the game | here |

## Does not own

- Presentation (apps/web, apps/mobile) and the platform container (iframe / WebView).
- The connection, reconnection and endings (Join Session), or the game's own visual state.
- Socket/iframe specifics: it depends on the `GameHost` abstraction and a `GameSessionPort`.

## Depends on

- `@playhoot/game-host`
- zustand (vanilla store only)

Architecture rules: `ARCHITECTURE.md`. Plan section references (§N) point to `docs/Playhoot_Frontend_Architecture_Plan.docx`.
