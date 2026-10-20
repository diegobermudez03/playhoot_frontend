# @playhoot/protocol

Shared wire and bridge contracts.

Status: STARTED: backend HTTP error body and codes, `POST /v1/guests`. No realtime or bridge contract yet. Repository-wide implementation state: `CURRENT_STATE.md` at the root.

## Owns

TypeScript types plus runtime validators for every message that crosses a boundary (plan §3.1, §11): backend HTTP request/response shapes, realtime (WebSocket) client<->server messages, and the versioned Game <-> Host bridge messages. The subpath `@playhoot/protocol/bridge` holds only the bridge contract, so the Game SDK can depend on it without pulling host-side contracts.

## Does not own

- Transport (sockets, fetch): that is `communication`.
- Behavior/business rules: the backend is the authority; this package only describes and validates shapes.
- Inventing contracts: backend shapes mirror what the backend actually implements (see `docs/architecture/BACKEND_CONTRACT.md`).

## Depends on

- Nothing.

## External dependencies

- zod (runtime validation; proposed in ADR-0001)

Architecture rules: `ARCHITECTURE.md`. Plan section references (§N) point to `docs/Playhoot_Frontend_Architecture_Plan.docx`.
