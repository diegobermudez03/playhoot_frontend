# @playhoot/feature-session-host

Session Host feature (logical state and ports).

Status: IMPLEMENTED: `createHostSession` (connecting, lobby with the game's player limits, start, cancel, watching a participant, play too, reconnection, typed outcomes) and `canStart`. Repository-wide implementation state: `CURRENT_STATE.md` at the root.

## Owns

The creator's side of a Session (session-play-v1 CHECKLIST P): the admin connection through `communication`, the lobby as the backend reports it, starting and cancelling, which participant is watched, whether the creator plays from this page, and a read-only live link the GameHost runs the watched player's game with (samples and commands dropped, no game fault reports).

## Does not own

- Presentation (apps/web, apps/mobile).
- The creator's player connection when they play (Join Session owns it; the app embeds it).
- Deciding whether a start is valid (the backend decides; `canStart` only enables the button).
- Surviving route exit: state is discarded and rebuilt from URL + backend.

## External dependencies

- zustand (vanilla store only)

## Depends on

- `@playhoot/app-core`
- `@playhoot/communication`
- `@playhoot/protocol`

Architecture rules: `ARCHITECTURE.md`. Plan section references (§N) point to `docs/Playhoot_Frontend_Architecture_Plan.docx`.
