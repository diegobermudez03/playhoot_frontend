# ADR-0002: Frontend-owned, shareable Session URLs

Status: ACCEPTED
Created: 2026-10-20
Last status change: 2026-10-20
Supersedes: None
Superseded by: None

## Context

The plan fixes only that a join link `/join/{joinCode}` opens the join experience directly (§5, §13.2). Session Play also needs a URL that survives refresh and reconnection, and the backend releases a Session's join code when it starts, so a URL built on the code stops working once the game runs. The backend exposes identifiers (`join_code`, `session_uuid`), never URLs.

## Decision

- URLs are a frontend concern. The backend returns identifiers only; the frontend composes every URL from them and is free to change its paths without any backend change.
- Every Session URL is shareable: whoever opens it, with an identity, connects directly using the identifier in the path.
- Routes:
  - `/join/:joinCode` — connect through the join code (`/v1/play/join/{joinCode}`).
  - `/sessions/:sessionUUID/play` — connect as a player through the Session UUID (`/v1/play/join/sessions/{sessionUUID}/player`).
- Once a player connected by code learns the Session UUID, the app replaces the URL with `/sessions/:sessionUUID/play` (history replace, not a new entry), so refresh and reconnection after the start use the UUID.
- Admin (host) routes follow the same pattern under `/sessions/:sessionUUID/...` when the admin experience is built.
- Only identifiers go in URLs, never tokens or other secrets (§5).

## Rationale

- The backend stays independent of frontend navigation (the human's explicit requirement).
- The UUID route works for the whole Session lifetime; the code route covers sharing a lobby by its human-friendly code.
- Replacing rather than pushing keeps back navigation sensible: going back does not return to a dead code URL.

## Alternatives Considered

### A single route by join code

Simpler, but breaks after the start because the backend releases the code; rebuilding from the URL would fail.

### `/play/:sessionUUID`

Equivalent; `/sessions/:sessionUUID/play` leaves room for other views of the same Session (host, results) under one prefix.

## Consequences

- A player connected by code must learn the Session UUID. Today the backend never sends it to players (`docs/architecture/BACKEND_CONTRACT.md` G4); session-play-v1 CHECKLIST Z2 tracks the backend change.

## Canonical Knowledge Impact

- `ARCHITECTURE.md` - "Navigation" lists the routes.

## Implementation Impact

Join Session (plan step 2) and Session Play (step 6) implement the routes; Z2 is needed before the UUID route can be reached from a code join.
