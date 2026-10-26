Process: Project execution (identity-web-v1), WORK per plan stage
Topic: Web client of basic identity per ../playhoot/plans/identity/05_Playhoot_Plan_de_Identidad_Basica.docx
Current stage: Project created 2026-10-25 with WORK-0001..0005 PLANNED; waits for the backend's WORK-0056 (contract) before WORK-0001 moves to DRAFT
Current execution surface: CODEBASE AGENT
Related durable artifacts: docs/projects/active/identity-web-v1/PROJECT.md, docs/decisions/architecture/ADR-0009-credential-renewal-in-the-transport.md, backend Project ../playhoot/docs/projects/active/identity-v1/
Blocked by: backend WORK-0056
Next action: after WORK-0056, design WORK-0001 (DRAFT)
Last durable checkpoint: Project and WORK files created, cross-reference in session-play-v1 PROJECT.md (2026-10-25)
Last updated: 2026-10-25

## Human decisions (2026-10-25)

- Identity before the SDK built-ins (CHECKLIST N) and the NativeGameHost prototype (CHECKLIST O) of session-play-v1.
- Refresh token held by the client (`localStorage` on the web) and sent in the body, so web and mobile share one backend contract; the plan's other decisions accepted as a whole.
- Tracking: one WORK per plan stage, designed just in time.
