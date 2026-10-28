# @playhoot/feature-sign-in

Sign In feature (logical state and ports).

Status: IMPLEMENTED for guests: `createGuestSignIn` (name, local validation, guest creation with one idempotency key per name, typed errors). Accounts wait for the backend's sign-in (backend `identity-v1` WORK-0059/0060). Repository-wide implementation state: `CURRENT_STATE.md` at the root.

## Owns

How a person becomes someone the backend accepts: playing as a guest (a name, kept in this browser for good) and, later, signing in or registering with an account. The app decides when to send someone here from the backend's operation catalog (`app-core` `operationAccess`) and where to return afterwards; this feature only authenticates and signs in through `app-core`.

## Does not own

- Presentation (apps/web, apps/mobile).
- Deciding which operation needs which level (the backend's catalog does).
- Where to go after signing in (the route's `next`).

## External dependencies

- zustand (vanilla store only)

## Depends on

- `@playhoot/app-core`
- `@playhoot/communication`
- `@playhoot/protocol`

Architecture rules: `ARCHITECTURE.md`. Plan section references (§N) point to `docs/Playhoot_Frontend_Architecture_Plan.docx`.
