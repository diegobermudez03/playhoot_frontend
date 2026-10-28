# WORK-0001: Client credential contract and decisions

Status: PLANNED
Created: 2026-10-25
Last status change: 2026-10-25

Related decisions:
- `docs/decisions/architecture/ADR-0009-credential-renewal-in-the-transport.md`
- Backend: `../playhoot/identity/docs/decisions/IDENTITY-ADR-0002-token-renewal-with-rotating-refresh-tokens.md` and the decisions of the backend's WORK-0056

Canonical context:
- `../playhoot/plans/identity/05_Playhoot_Plan_de_Identidad_Basica.docx` (§6 "Coordinación del frontend", §7)
- `docs/architecture/BACKEND_CONTRACT.md`

## Outcome

The client's side of the plan's decisions recorded before code: what the web keeps and where (access token and expiry in memory, refresh token in `localStorage` per the human's 2026-10-25 decision), one coordinator per origin for every credential-changing request (in-tab shared promise, cross-tab exclusion such as Web Locks, change notification), the authentication generation that discards stale results, and the protocol types for the backend's endpoints. ADR-0009 left the storage location open; this closes it.

## Context

Today `apps/web/src/platform/browserCredentialStore.ts` keeps the whole credential in `localStorage` and `CredentialRefresher` is the `noCredentialRefresh` placeholder. The plan's coordination rules (§6) still apply with a client-held refresh token: same `request_id` on retries, never in parallel, no fake mutex made of reads and writes to `localStorage`, explicit and tested behavior when Web Locks are missing. The backend contract depends on it (backend WORK-0056 review, 2026-10-27): every tab shares the stored refresh token, so two tabs refreshing it with different `request_id`s count as reuse and revoke the family, which loses a guest for good; credential-changing calls are serialized per origin across tabs and the stored token is re-read inside the lock before refreshing.

## Scope

Not yet designed.

## Blockers

- The backend's WORK-0056 (contract and DTOs).
