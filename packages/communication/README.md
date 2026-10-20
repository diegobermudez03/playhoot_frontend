# @playhoot/communication

HTTP/WebSocket clients and credential-aware transport.

Status: SCAFFOLD, no behavior yet. Repository-wide implementation state: `CURRENT_STATE.md` at the root.

## Owns

Encapsulates external operations behind semantic, typed clients (plan §4.3, §13.6, §13.7): an HTTP client and the realtime `SessionClient` (connect/join, subscribe to semantic events, SAMPLE, COMMAND, leave, reconnect/rejoin, resync). Attaches credentials automatically through a credential provider and translates transport/protocol failures into typed results.

## Does not own

- Feature lifecycle state: features call semantic methods and never touch the raw socket.
- UI decisions about how to show an error.
- Where SAMPLE sequence and COMMAND idempotency mechanics live exactly (shared with `game-host`) is decided when the realtime client is designed.

## Depends on

- `@playhoot/protocol`
- `@playhoot/app-core`

Architecture rules: `ARCHITECTURE.md`. Plan section references (§N) point to `docs/Playhoot_Frontend_Architecture_Plan.docx`.
