# Project: Identity Web v1 (basic identity, web client)

Status: ACTIVE
Created: 2026-10-25
Last updated: 2026-10-25

## Goal

The web client of real identity, as planned in the backend's `../playhoot/plans/identity/05_Playhoot_Plan_de_Identidad_Basica.docx` (the "plan"; `§N` points to its sections): a person plays as a guest who keeps their identity across reloads, or signs in with Google and gets back the same account on any device; credentials renew in the background (ADR-0009) and a person never sees an authorization error. Together with the backend Project `identity-v1` it replaces the fixed test identities: an account creates a Session, two real guests from separate browsers join and play it.

Decided by the human on 2026-10-25: this project goes before the SDK built-ins (CHECKLIST N) and the NativeGameHost prototype (CHECKLIST O) of `session-play-v1`, which stays active meanwhile.

## Explicitly Out Of Scope

- The mobile app's credential adapter (secure storage): the backend contract is chosen so it can reuse it, but it is built with the mobile project.
- Guest-to-account upgrade, account reconciliation, profiles, avatar, device management screens, guest recovery (plan intro, §3).
- Passwords and providers other than Google (plan §2).
- Remote closing of already open connections on revocation (plan §5); the client closes its own sockets on logout or a real user switch.

## Current Work

Created 2026-10-25. The human accepted the plan except the refresh token location: the client keeps it (web `localStorage`) and sends it in the request body instead of an `HttpOnly` cookie, so the web and the future mobile app share one backend contract. Next: WORK-0001, after the backend's WORK-0056 records the contract.

## Work

| Order | Work | Status |
|------:|------|--------|
| 0 | [WORK-0001](works/WORK-0001-client-credential-contract-and-decisions.md) — Client credential contract and decisions | PLANNED |
| 1 | [WORK-0002](works/WORK-0002-real-guest-on-the-web.md) — Real guest on the web | PLANNED |
| 2 | [WORK-0003](works/WORK-0003-account-sign-in-with-the-local-provider.md) — Account sign-in with the local provider | PLANNED |
| 3 | [WORK-0004](works/WORK-0004-google-sign-in-on-the-web.md) — Google sign-in on the web | PLANNED |
| 4 | [WORK-0005](works/WORK-0005-identity-web-integration-and-closure.md) — Integration and closure | PLANNED |

## Ordering / Dependencies

Each frontend WORK pairs with a backend WORK of `identity-v1` (the backend owns every client-facing contract):

| Frontend | Needs in the backend |
|---|---|
| WORK-0001 | WORK-0056 (contracts and decisions) |
| WORK-0002 | WORK-0057, WORK-0058 (persisted core, guests, refresh, logout) |
| WORK-0003 | WORK-0059 (accounts with the simulated provider) |
| WORK-0004 | WORK-0060 (Google OIDC) |
| WORK-0005 | WORK-0061 (integration and closure) |

Backend changes are made through the backend's own workflow, only when the human directs them (orchestrator "Cross-Repository Concerns"); `docs/architecture/BACKEND_CONTRACT.md` is updated only with what the backend actually implements.

## Capability Coverage

The plan's acceptance criteria (§11) are the coverage list; each WORK names the client-side criteria it owns once it moves to DRAFT.

## Material Decisions Needing Human Input

1. **Google login completion without a cookie** (agent proposal, decided in the backend's WORK-0056): the callback redirects to the web with a one-time code that the client exchanges, with a verifier it generated at start, for access and refresh.
2. **Creating a Session in the local closure**: the plan's closure has a persisted account create a Session; creating Sessions from the UI is out of scope of `session-play-v1`. Decide in WORK-0003 whether a dev tool is enough or the account gets a minimal "create Session" screen.

## Completion Criteria

The project is complete when every WORK above is DONE (or explicitly cancelled by the human), the plan's client-side acceptance criteria are verified (`npm run check` green, browser end to end against the real backend), the local closure (account creates, two guests in separate browser contexts play) and the Google closure are demonstrated, and durable knowledge is promoted (`CURRENT_STATE.md`, ADRs, `docs/logic/`, package READMEs, `BACKEND_CONTRACT.md`).
