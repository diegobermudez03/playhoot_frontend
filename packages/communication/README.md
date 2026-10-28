# @playhoot/communication

HTTP/WebSocket clients and credential-aware transport.

Status: REALTIME CLIENT: HTTP client, `IdentityClient` (guests, operation catalog), `SessionsClient` (create a Session), `AdminConnector` (the creator's admin connection: start, cancel, perspective, the watched participant's reconciled views), `SessionConnector` (player connection, message validation, close classification, coalesced SAMPLEs, correlated and retried COMMANDs, reconciled views with automatic resync and `currentView()` (state + ack), leave, game fault reports), and `createTelemetryReporter` (client telemetry in batches to the backend, ADR-0007). Repository-wide implementation state: `CURRENT_STATE.md` at the root.

## Owns

Encapsulates external operations behind semantic, typed clients (plan §4.3, §13.6, §13.7): an HTTP client and the realtime `SessionClient` (connect/join, subscribe to semantic events, SAMPLE, COMMAND, leave, reconnect/rejoin, resync). Attaches credentials automatically through a credential provider and translates transport/protocol failures into typed results.

## Does not own

- Feature lifecycle state: features call semantic methods and never touch the raw socket.
- UI decisions about how to show an error.
- Which telemetry event an app event becomes, or an error's origin: the app classifies (`apps/web/src/telemetry`).
- Where SAMPLE sequence and COMMAND idempotency mechanics live exactly (shared with `game-host`) is decided when the realtime client is designed.

Credential renewal (ADR-0009): on `401 token_invalid` the HTTP client renews the credential once and retries; only an unrenewable credential reaches `onCredentialRejected`.

## Depends on

- `@playhoot/protocol`
- `@playhoot/app-core`

Architecture rules: `ARCHITECTURE.md`. Plan section references (§N) point to `docs/Playhoot_Frontend_Architecture_Plan.docx`.
