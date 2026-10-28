# WORK-0002: Real guest on the web

Status: DONE
Created: 2026-10-25
Last status change: 2026-10-27 (decided by the human in conversation under the working agreement; implemented with WORK-0001)

Related decisions:
- `docs/decisions/architecture/ADR-0009-credential-renewal-in-the-transport.md`
- The decisions of WORK-0001

Canonical context:
- `../playhoot/plans/identity/05_Playhoot_Plan_de_Identidad_Basica.docx` (§4 "Invitado", §6, §7 "Restauración y errores")

## Outcome

A guest that is a real, persisted person: guest creation waits for credential restoration before offering a new guest, the real `CredentialRefresher`, restoration on reload (a timeout, `503` or database failure keeps a recoverable state and never creates another guest), renewal before opening or reopening a WebSocket, logout that closes sockets and disposes the GameHost, and the cross-tab coordinator. Two guests in different browsers get different identities and play the same Session (plan §10 stage 2).

## Context

The HTTP transport already retries once after renewal (ADR-0009). A `403` never starts a refresh; the refresh call never goes through the retrying interceptor (§7). Renewing the same user's token never rebuilds the game (§6).

## Scope

Decided by the human in conversation on 2026-10-27, redesigning the backend's credentials (backend IDENTITY-ADR-0003 amendment): JWT access tokens, refresh tokens stored as-is server side, renewal with the refresh token alone that keeps it unless it is over 5 hours old (then rotated), the immediate predecessor accepted for 5 minutes after a rotation (answering with the current refresh token), anything else stale rejected. With no reuse detection, two tabs renewing at once cannot revoke anything: the cross-tab coordinator (Web Locks, request ids) planned here is not needed and was dropped. Done as one vertical slice with WORK-0002 and the backend's WORK-0057/0058 ("real guests end to end"); accounts stay the backend's development bypass until WORK-0003. Updates `docs/logic/` (flows and mirror) in the same change.

Built: the real `CredentialRefresher` (`POST /v1/identity/refresh`; only `refresh_invalid` forgets, an unreachable backend keeps the credential and retries with backoff), restoration on load before anything uses the credential (never creating another guest meanwhile), renewal a minute before expiry measured on the device's clock (`access_expires_in`) and when the tab is shown again, sign out that ends the backend session, the guest page with the backend's name and a fresh idempotency key after a `409`. Not built, on purpose: renewing synchronously before opening a WebSocket (the connectors read the current token; after a failed renewal the retry renews it and the features' reconnection uses it), and closing sockets on logout beyond what leaving the route does (a guest has no sign out today).

## Blockers

None.

## Completion Record

- Implementation: `packages/app-core/src/{credentials,appState}.ts`, `packages/communication/src/{http,identityClient}.ts`, `packages/protocol/src/http/guests.ts`, `packages/features/sign-in/src/guestSignIn.ts`, `apps/web/src/{app/services.ts,platform/browserCredentialStore.ts}`.
- Verification: `npm run check` (231 tests); headless Edge against the real backend: two guests in separate browser contexts with different users seeing each other's names in one Session, a reload and a backend restart (new random access key) keeping the same guest, the host flow with the development account seeing the guest's real name (27 checks).
- Independent review: CHANGES_REQUIRED (a renewal overtaken by another tab's rotation was dropped yet reported as renewed, no retry of a failed scheduled renewal, a fast device clock looping renewals, a spent guest key reused, logout racing a rotation in the backend, issue-time skew in the backend, stale backend contract doc); all fixed with tests. Re-review: APPROVED.
- Docs: `CURRENT_STATE.md`, `docs/architecture/BACKEND_CONTRACT.md`, ADR-0009 amendment, `docs/logic/FLOWS.md` (calls table, flows 1 and 10) and mirror (`state_app.go`, `external.go`, `view_sign_in_guest.go`), `apps/web/README.md`.
