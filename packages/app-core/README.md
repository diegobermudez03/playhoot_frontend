# @playhoot/app-core

App-global contracts, state and bootstrap.

Status: FOUNDATION: credential ports, auth snapshot, app-global store (`createAppState`). Repository-wide implementation state: `CURRENT_STATE.md` at the root.

## Owns

Truly global state only (plan §4.4, §13.1, §14): the authentication/identity snapshot (unknown/loading, authenticated, guest, none), the current language (supported languages, resolution from the device, persisted choice), visibility capabilities from a future bootstrap/me endpoint, and app-level config that several features genuinely need. Also the app bootstrap sequence contract.

## Does not own

- Per-feature state of visited screens (it belongs to each feature and is discarded on route exit).
- Authorization: visibility is UX, never a security barrier (§14).
- Transport details: credentials are handed to `communication` through a provider, not read by callers.

## Depends on

- Nothing.

## External dependencies

- zustand (vanilla store only; React bindings live in the apps)

Architecture rules: `ARCHITECTURE.md`. Plan section references (§N) point to `docs/Playhoot_Frontend_Architecture_Plan.docx`.
