# ADR-0009: Credential renewal in the transport

Status: ACCEPTED
Created: 2026-10-25
Last status change: 2026-10-25
Amended: 2026-10-27 (implemented against the backend's real credentials; see the Amendment)
Supersedes: None
Superseded by: None

## Context

The plan (§14) has the communication layer attach credentials through a provider and the frontend respect a backend `401/403` even when it believed it was signed in. Real authentication does not exist yet (backend Identity is a placeholder); it is the project right after the Session lifecycle and the SDK built-ins. Until now a refused credential was simply forgotten and the next join asked for a name again. The token rules themselves are the backend's: `../playhoot/identity/docs/decisions/IDENTITY-ADR-0002-token-renewal-with-rotating-refresh-tokens.md`.

## Decision

Decided by the human on 2026-10-25:

1. **A person never sees an authorization error.** The transport renews a refused credential in the background and retries; only a credential that cannot be renewed ends in sign-in (or, for a guest, a new guest).
2. **Built now (the structure):** the HTTP client, on `401 token_invalid` for a request that carried a token, asks the credential provider to `refresh()` once and sends the request again with the new token; if it cannot renew, or the retried request is refused again, it forgets the credential as before. The app state owns `refresh()`: one renewal shared by concurrent calls, a renewal that finishes after the person signed out or switched credentials is dropped, and the renewed credential is saved. The renewal itself is a `CredentialRefresher` port; today `noCredentialRefresh` never renews.
3. **Accepted direction for the authentication project** (backend IDENTITY-ADR-0002): short access tokens (about 15 min), rotating refresh tokens, renewal on demand (on a refused or about-to-expire access token, not on every navigation), accounts that expire by inactivity (30 days) and an absolute maximum (90 days), guests that never expire in their browser.
4. **WebSocket:** a token expiring during an open connection does not affect it; only opening one does, and a refused handshake cannot be read by a browser. Once tokens carry their expiry, the connector renews a token about to expire before opening a live connection.
5. **Open for the authentication project:** where the refresh token is kept (an `httpOnly` cookie versus browser storage), the sign-in screen, the guest-to-account upgrade.

## Rationale

- Renewal belongs to the transport, like attaching the credential: features and screens never handle it (plan §4.3, §14).
- Building the middleware now keeps the change of the authentication project to one port implementation and the endpoint behind it.

## Alternatives Considered

### Showing "your session expired, sign in again"

Rejected by the human: an expired access token is routine, not something the person should handle.

### Renewing on every route change

Rejected (IDENTITY-ADR-0002): on-demand renewal already extends an active session.

## Consequences

- One retry per refused request, never a loop.
- Until authentication exists nothing changes in behavior: the placeholder never renews.
- `noCredentialRefresh` is listed as a placeholder in `CURRENT_STATE.md` and the Project checklist.

## Amendment (2026-10-27)

Implemented with the backend's real credentials (backend IDENTITY-ADR-0003 as amended, `identity-web-v1` WORK-0001/0002): the refresh token is kept in browser storage (decided by the human 2026-10-25), never with the access token, which lives in memory; `POST /v1/identity/refresh` renews it, with the refresh token alone. Point 5 is settled that way. Beyond point 2: a stored credential is renewed on load before anything uses it (retried while the backend cannot be reached, never replaced by a new guest meanwhile); the access token is renewed a minute before it expires and when the tab is shown again close to expiry; only `refresh_invalid` forgets the credential, an unreachable backend keeps it; concurrent renewals are one; another tab's rotated refresh token is picked up from storage. `noCredentialRefresh` remains only as the default for an app without an authentication backend.

## Canonical Knowledge Impact

- `docs/logic/FLOWS.md` (authorization failures), `packages/app-core` and `packages/communication` READMEs.

## Implementation Impact

The authentication project implements `CredentialRefresher` against the backend's refresh endpoint and the pre-connection renewal for WebSockets.
