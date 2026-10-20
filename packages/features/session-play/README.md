# @playhoot/feature-session-play

Session Play feature (logical state and ports).

Status: SCAFFOLD, no behavior yet. Repository-wide implementation state: `CURRENT_STATE.md` at the root.

## Owns

`SessionPlayState` (plan §12, §13.3-§13.8): lifecycle (loading/lobby/running/terminal), connection (connecting/connected/reconnecting/disconnected), session identity and role, current PlayerProjection and stream baseline/revision, platform messages/errors, GameVersion artifact metadata, GameHost readiness, relevant capabilities. Coordinates `SessionClient` and a `GameHost`; does not know the game's internal state or DOM.

## Does not own

- Presentation (apps/web, apps/mobile).
- The game's visual state.
- Socket/iframe specifics: it depends on `SessionClient` and the `GameHost` abstraction, not on WebSocket/iframe APIs.

## Depends on

- `@playhoot/app-core`
- `@playhoot/communication`
- `@playhoot/game-host`
- `@playhoot/device`
- `@playhoot/protocol`

Architecture rules: `ARCHITECTURE.md`. Plan section references (§N) point to `docs/Playhoot_Frontend_Architecture_Plan.docx`.
