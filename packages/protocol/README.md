# @playhoot/protocol

Shared wire and bridge contracts.

Status: PLAYER PROTOCOL: HTTP error body and codes, `POST /v1/guests`, every player realtime message both ways, client limits. Game <-> Host bridge v1 (ADR-0005, which owns the catalog). The admin messages are not modeled yet. Repository-wide implementation state: `CURRENT_STATE.md` at the root.

## Owns

TypeScript types plus runtime validators for every message that crosses a boundary (plan §3.1, §11): backend HTTP request/response shapes, realtime (WebSocket) client<->server messages, and the versioned Game <-> Host bridge messages. The subpath `@playhoot/protocol/bridge` holds only the bridge contract as dependency-free types and constants, so the Game SDK can depend on it without pulling host-side contracts or zod into game artifacts; the Host's validators for game messages are in `@playhoot/protocol/bridge/validation`.

## Does not own

- Transport (sockets, fetch): that is `communication`.
- Behavior/business rules: the backend is the authority; this package only describes and validates shapes.
- Inventing contracts: backend shapes mirror what the backend actually implements (see `docs/architecture/BACKEND_CONTRACT.md`).

## Depends on

- Nothing.

## External dependencies

- zod (runtime validation; proposed in ADR-0001)

Architecture rules: `ARCHITECTURE.md`. Plan section references (§N) point to `docs/Playhoot_Frontend_Architecture_Plan.docx`.
