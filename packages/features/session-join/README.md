# @playhoot/feature-session-join

Join Session feature (logical state and ports).

Status: SCAFFOLD, no behavior yet. Repository-wide implementation state: `CURRENT_STATE.md` at the root.

## Owns

Feature state and communication ports for opening `/join/{joinCode}` directly (plan §5, §13.2, §18 step 2): read the auth snapshot, run the identity/guest flow when needed, read the device capabilities the join needs, open the backend join flow through `communication`, and expose accepted / rejected-with-typed-reason state plus the transition to Session Play. Web/mobile presentation lives in the apps.

## Does not own

- Presentation (apps/web, apps/mobile).
- Deciding whether joining is allowed (the backend decides).
- Surviving route exit: state is discarded and rebuilt from URL + backend.

## Depends on

- `@playhoot/app-core`
- `@playhoot/communication`
- `@playhoot/device`
- `@playhoot/protocol`

Architecture rules: `ARCHITECTURE.md`. Plan section references (§N) point to `docs/Playhoot_Frontend_Architecture_Plan.docx`.
