# WORK-0005: Identity web integration and closure

Status: PLANNED
Created: 2026-10-25
Last status change: 2026-10-25

Related decisions:
- The decisions of WORK-0001

Canonical context:
- `../playhoot/plans/identity/05_Playhoot_Plan_de_Identidad_Basica.docx` (§11)

## Outcome

The client side verified as a whole: network and concurrency cases across tabs, user switches whose stale responses never update memory or the game, logout that is never shown as confirmed when the server did not confirm it, the game boundary (bridge, assets and scripts never receive tokens or the external identity; logs and client telemetry never record them), and documents synchronized (`CURRENT_STATE.md`, ADRs, `docs/logic/`, package READMEs, `BACKEND_CONTRACT.md`). Ends with the local and Google closures demonstrated in browsers.

## Scope

Not yet designed. Its content depends on what WORK-0002 to WORK-0004 leave open.

## Blockers

- WORK-0002, WORK-0003, WORK-0004; backend WORK-0061.
