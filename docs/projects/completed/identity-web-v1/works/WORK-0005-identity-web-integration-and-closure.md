# WORK-0005: Identity web integration and closure

Status: DONE
Created: 2026-10-25
Last status change: 2026-10-31 (the human answered the closure questions in conversation; closed with the backend's WORK-0061)

Related decisions:
- The decisions of WORK-0001

Canonical context:
- `../playhoot/plans/identity/05_Playhoot_Plan_de_Identidad_Basica.docx` (§11)

## Outcome

The client side verified as a whole: network and concurrency cases across tabs, user switches whose stale responses never update memory or the game, logout that is never shown as confirmed when the server did not confirm it, the game boundary (bridge, assets and scripts never receive tokens or the external identity; logs and client telemetry never record them), and documents synchronized (`CURRENT_STATE.md`, ADRs, `docs/logic/`, package READMEs, `BACKEND_CONTRACT.md`). Ends with the local and Google closures demonstrated in browsers.

## Scope

The client side of the closure decisions (backend IDENTITY-ADR-0003, 2026-10-31): logout is local first and never waits for the backend; the client closes its own live connections when signing out, an admitted one is not closed by the backend; guests have no sign-out. Evidence: tabs racing a renewal never revoke each other and a renewal started for an earlier person never applies (`appState` tests); an unreachable backend keeps the credential and retries, never creating another guest; the GameHost and client telemetry never receive tokens, codes or verifiers (audited 2026-10-31); the local closure demonstrated in headless Edge. Found by the closure review and fixed: another tab switching identity left this tab's live connections open as the previous person; the root layout now keys every page on the person (`apps/web/src/app/identityKey.ts`), so they are closed and rebuilt for the new one (headless Edge `switch_flow`, 7 checks). Moved to Identity phase 2 with the backend: the account screen (display name changes), active sessions, guest sign-out; the Google closure is the planned follow-up of WORK-0004.

## Blockers

None.

## Completion Record

- Verification: `npm run check`; headless Edge walkthroughs (guests, accounts, host, Google button).
- Independent review against §11: with the backend's WORK-0061, APPROVED after the identity-switch fix.
