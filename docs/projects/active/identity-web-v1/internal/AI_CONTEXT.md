Process: Project execution (identity-web-v1), WORK per plan stage
Topic: Web client of basic identity per ../playhoot/plans/identity/05_Playhoot_Plan_de_Identidad_Basica.docx
Current stage: WORK-0006 IMPLEMENTING (2026-10-27): catalog + RequireOperation + /sign-in + /sign-in/guest + corner menu built and verified (npm run check, browser walk-through: scratchpad e2e/signin_flow.mjs with Edge --headless=old; new headless loses the main frame). Uncommitted. Next: "Create Session" with session-play-v1 CHECKLIST P (host experience) and backend Z13 (min/max players in the admin lobby_update)
Current execution surface: CODEBASE AGENT
Related durable artifacts: docs/projects/active/identity-web-v1/PROJECT.md, docs/decisions/architecture/ADR-0009-credential-renewal-in-the-transport.md, backend Project ../playhoot/docs/projects/active/identity-v1/
Blocked by: nothing
Next action: host experience (session-play-v1 P) + Create Session button; then WORK-0001 when backend WORK-0057/0058 approach
Last durable checkpoint: Project and WORK files created, cross-reference in session-play-v1 PROJECT.md (2026-10-25)
Last updated: 2026-10-27

## Working agreement (the human, 2026-10-27)

Decisions are made in conversation; the agent writes code and the human reviews the code itself; code the human does not ask to change is approved. WORK files, ADRs, PROJECT.md and reviews are the agent's own memory, kept current silently: never ask the human to read or approve them, never present DRAFT/READY gates or HUMAN_REVIEW files. A decision in chat is the human approval the repository process needs (record it in the WORK/ADR yourself).

## Human decisions (2026-10-25)

- Identity before the SDK built-ins (CHECKLIST N) and the NativeGameHost prototype (CHECKLIST O) of session-play-v1.
- Refresh token held by the client (`localStorage` on the web) and sent in the body, so web and mobile share one backend contract; the plan's other decisions accepted as a whole.
- Tracking: one WORK per plan stage, designed just in time.

## Human decisions (2026-10-27)

- Scope added: WORK-0006. Global pattern: catalog of operations and minimum levels at startup; redirect to the most flexible authentication allowed and return to `next`; definitive `/sign-in`; guest page with the account option (join no longer asks the name inline); corner button (anonymous: sign in/up; guest: name + sign in, with the identity-switch warning; account: name + sign out); minimal "Create Session" requiring an account. Takes over session-play-v1 CHECKLIST L.
