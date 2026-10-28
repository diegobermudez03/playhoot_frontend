# @playhoot/feature-session-join

Join Session feature (logical state and ports).

Status: IMPLEMENTED: `createJoinSession` (connecting, lobby, started, typed outcomes, reconnection by Session UUID). During a game a lost connection keeps the phase `started` with `connection: 'reconnecting'`, so Session Play keeps the game on screen; `live` is a link to whatever connection is current (sample, command, current view, and the `open` / `view` / `sample-sent` events), which Session Play's GameHost uses. Repository-wide implementation state: `CURRENT_STATE.md` at the root.

## Owns

Feature state and communication ports for opening `/join/{joinCode}` directly (plan §5, §13.2, §18 step 2): read the auth snapshot (the app opens the feature only once the person has an identity the backend accepts for joining; becoming a guest is `@playhoot/feature-sign-in`), read the device capabilities the join needs, open the backend join flow through `communication`, and expose accepted / rejected-with-typed-reason state plus the transition to Session Play. Web/mobile presentation lives in the apps; the web embeds the same player screens in the host screen for a creator who plays (`PlayerSession` with `embedded`: no URL changes, leaving reported to the host).

## Does not own

- Presentation (apps/web, apps/mobile).
- Deciding whether joining is allowed (the backend decides).
- Surviving route exit: state is discarded and rebuilt from URL + backend.

## External dependencies

- zustand (vanilla store only)

## Depends on

- `@playhoot/app-core`
- `@playhoot/communication`
- `@playhoot/device`
- `@playhoot/protocol`

Architecture rules: `ARCHITECTURE.md`. Plan section references (§N) point to `docs/Playhoot_Frontend_Architecture_Plan.docx`.
