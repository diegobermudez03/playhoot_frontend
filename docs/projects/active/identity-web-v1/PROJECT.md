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

Created 2026-10-25. The human accepted the plan except the refresh token location: the client keeps it (web `localStorage`) and sends it in the request body instead of an `HttpOnly` cookie, so the web and the future mobile app share one backend contract. The backend's contract (WORK-0056) and operation catalog (WORK-0062) were done 2026-10-27. WORK-0006 IMPLEMENTING since 2026-10-27: the catalog in the global state, `RequireOperation` on the Session routes, `/sign-in` and `/sign-in/guest` with return to `next`, guest creation moved out of Join into `@playhoot/feature-sign-in`, and the top bar corner are built and verified (unit tests, `npm run check`, browser walk-through against the real backend); its "Create Session" button is built together with `session-play-v1` CHECKLIST P (host experience), next.

## Work

| Order | Work | Status |
|------:|------|--------|
| 0 | [WORK-0001](works/WORK-0001-client-credential-contract-and-decisions.md) — Client credential contract and decisions | PLANNED |
| 0b | [WORK-0006](works/WORK-0006-authentication-levels-sign-in-routes-and-return-to-intent.md) — Authentication levels, sign-in routes and return to intent | DONE |
| 1 | [WORK-0002](works/WORK-0002-real-guest-on-the-web.md) — Real guest on the web | PLANNED |
| 2 | [WORK-0003](works/WORK-0003-account-sign-in-with-the-local-provider.md) — Account sign-in with the local provider | PLANNED |
| 3 | [WORK-0004](works/WORK-0004-google-sign-in-on-the-web.md) — Google sign-in on the web | PLANNED |
| 4 | [WORK-0005](works/WORK-0005-identity-web-integration-and-closure.md) — Integration and closure | PLANNED |

## Ordering / Dependencies

Each frontend WORK pairs with a backend WORK of `identity-v1` (the backend owns every client-facing contract):

| Frontend | Needs in the backend |
|---|---|
| WORK-0001 | WORK-0056 (contracts and decisions) |
| WORK-0006 | WORK-0062 (operation catalog); its guest and account completions also need WORK-0002 and WORK-0003 here |
| WORK-0002 | WORK-0057, WORK-0058 (persisted core, guests, refresh, logout) |
| WORK-0003 | WORK-0059 (accounts with the simulated provider) |
| WORK-0004 | WORK-0060 (Google OIDC) |
| WORK-0005 | WORK-0061 (integration and closure) |

Backend changes are made through the backend's own workflow, only when the human directs them (orchestrator "Cross-Repository Concerns"); `docs/architecture/BACKEND_CONTRACT.md` is updated only with what the backend actually implements.

## Capability Coverage

The plan's acceptance criteria (§11) are the coverage list; each WORK names the client-side criteria it owns once it moves to DRAFT.

## Material Decisions Needing Human Input

1. **Google login completion without a cookie**: ACCEPTED by the human on 2026-10-27 (recorded in the backend's WORK-0056): the callback redirects to the web with a one-time code that the client exchanges, with a verifier it generated at start, for access and refresh.
2. **Admin after "Create Session"**: resolved by the human on 2026-10-27: the definitive host experience (create and share, lobby with Start enabled by player limits, cancel, play too, switch perspectives) is pulled into `session-play-v1` (its CHECKLIST P, backend Z13) and built together with WORK-0006, whose "Create Session" button (hardcoded game for now) is its entry.

Added by the human on 2026-10-27 (WORK-0006, with the backend's WORK-0062): the catalog of operations with their minimum authentication level read at startup; operations shown above the person's level redirect to the most flexible authentication allowed and return to the intended path; the definitive `/sign-in` route; the guest page with the account option; the corner sign-in/profile button (guests show their name and "Sign in"). This takes over `session-play-v1` CHECKLIST L.

## Completion Criteria

The project is complete when every WORK above is DONE (or explicitly cancelled by the human), the plan's client-side acceptance criteria are verified (`npm run check` green, browser end to end against the real backend), the local closure (account creates, two guests in separate browser contexts play) and the Google closure are demonstrated, and durable knowledge is promoted (`CURRENT_STATE.md`, ADRs, `docs/logic/`, package READMEs, `BACKEND_CONTRACT.md`).
