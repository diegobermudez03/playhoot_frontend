# WORK-0001: Client credential contract and decisions

Status: DONE
Created: 2026-10-25
Last status change: 2026-10-27 (decided by the human in conversation under the working agreement; done with WORK-0002)

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

Decided by the human in conversation on 2026-10-27, redesigning the backend's credentials (backend IDENTITY-ADR-0003 amendment): JWT access tokens, refresh tokens stored as-is server side, renewal with the refresh token alone that keeps it unless it is over 5 hours old (then rotated), the immediate predecessor accepted for 5 minutes after a rotation (answering with the current refresh token), anything else stale rejected. With no reuse detection, two tabs renewing at once cannot revoke anything: the cross-tab coordinator (Web Locks, request ids) planned here is not needed and was dropped. Done as one vertical slice with WORK-0002 and the backend's WORK-0057/0058 ("real guests end to end"); accounts stay the backend's development bypass until WORK-0003.

What the web keeps: the access token and its expiry in memory only; the refresh token, user, level and name in `localStorage` (`playhoot.credential.v2`; v1 left behind). Within a tab one renewal is shared and a renewal started for an earlier person never applies (a generation counter); across tabs the stored refresh token is re-read before renewing and other tabs' changes are followed through the `storage` event. Protocol types in `packages/protocol/src/http/guests.ts`. ADR-0009 amended.

## Blockers

None.

## Completion Record

See WORK-0002 (one change).
