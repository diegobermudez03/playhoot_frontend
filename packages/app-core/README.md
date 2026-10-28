# @playhoot/app-core

App-global contracts, state and bootstrap.

Status: FOUNDATION: credential ports, auth snapshot, app-global store (`createAppState`), access levels and the backend's operation catalog (`operationAccess`). Repository-wide implementation state: `CURRENT_STATE.md` at the root.

## Owns

Truly global state only (plan §4.4, §13.1, §14): the authentication/identity snapshot (unknown/loading, authenticated, guest, none), the current language (supported languages, resolution from the device, persisted choice), visibility capabilities from a future bootstrap/me endpoint, and app-level config that several features genuinely need. Also the app bootstrap sequence contract.

## Does not own

- Per-feature state of visited screens (it belongs to each feature and is discarded on route exit).
- Authorization: visibility is UX, never a security barrier (§14).
- Transport details: credentials are handed to `communication` through a provider, not read by callers.

Access (backend IDENTITY-ADR-0003): the backend's catalog says the minimum level of each operation on `anonymous < guest < account`; `operationAccess` turns the auth snapshot and the catalog into pending / allowed / needs guest or account, which the apps use to decide where to send a person. Guidance only, never authorization.

Credential renewal (ADR-0009): `credentials.refresh()` renews a refused credential once for every concurrent caller through the `CredentialRefresher` port (placeholder `noCredentialRefresh` until authentication exists).

## Depends on

- Nothing.

## External dependencies

- zustand (vanilla store only; React bindings live in the apps)

Architecture rules: `ARCHITECTURE.md`. Plan section references (§N) point to `docs/Playhoot_Frontend_Architecture_Plan.docx`.
