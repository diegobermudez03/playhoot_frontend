# WORK-0003: Account sign-in with the local provider

Status: PLANNED
Created: 2026-10-25
Last status change: 2026-10-25

Related decisions:
- The decisions of WORK-0001

Canonical context:
- `../playhoot/plans/identity/05_Playhoot_Plan_de_Identidad_Basica.docx` (§3 "Conversión futura", §9, §10 "Fronteras de implementación")
- `docs/design/DESIGN_SYSTEM.md`, `docs/design/ASSETS.md`

## Outcome

Accounts usable locally against the backend's simulated provider: the sign-in entry ("Continue with Google"), the guest name step, restoration state, minimal visible identity, logout and error recovery, in the existing languages; the explicit identity switch from a guest, warned before it starts (participations are not transferred; cancelling keeps the guest); return after sign-in limited to internal destinations, keeping the navigation's purpose; `DevIdentityPicker` and `dev-host` moved to the real backend flow, with no magic test tokens left (plan §10 stage 3).

## Context

New visual assets (for example the Google button mark, following Google's branding rules) are registered in `apps/web/src/assets/assets.json` and documented in `docs/design/ASSETS.md`.

## Scope

Not yet designed.

## Blockers

- WORK-0002; backend WORK-0059.
- PROJECT.md decision 2: how a persisted account creates a Session in the local closure.
