# WORK-0002: Real guest on the web

Status: PLANNED
Created: 2026-10-25
Last status change: 2026-10-25

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

Not yet designed. Updates `docs/logic/` (flows and mirror) in the same change.

## Blockers

- WORK-0001; backend WORK-0057 and WORK-0058.
