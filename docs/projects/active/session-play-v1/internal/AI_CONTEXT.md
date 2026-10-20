Process: Project execution (session-play-v1), human-directed implementation
Topic: First web vertical slice (join link → join → play) per docs/Playhoot_Frontend_Architecture_Plan.docx
Current stage: repository foundation scaffolded and AI workflow set up (2026-10-19); waiting for the human's review and direction for plan step 1
Current execution surface: CODEBASE AGENT
Related durable artifacts: docs/projects/active/session-play-v1/PROJECT.md, docs/projects/active/session-play-v1/CHECKLIST.md, docs/Playhoot_Frontend_Architecture_Plan.docx, ARCHITECTURE.md, docs/architecture/BACKEND_CONTRACT.md, docs/decisions/architecture/ADR-0001-workspace-tooling-for-the-frontend-foundation.md
Blocked by: nothing (open human decisions listed in PROJECT.md)
Next action: wait for the human's next instruction; likely plan step 1 (routing, AppGlobalState, communication abstractions, DeviceCapabilities, dev proxy)
Last durable checkpoint: scaffold + docs created, `npm run check` and `npm run build` pass (2026-10-19)
Last updated: 2026-10-19

## Working agreement (copied from the backend's practice; confirm with the human, PROJECT.md decision 1)

- The human directs what to implement and in what order. Do not plan a task order on your own.
- The agent debates, proposes, and flags where an instruction is under-specified or does not satisfy the plan; the human decides.
- The plan is the skeleton; concrete implementation is decided together, step by step.
- CHECKLIST.md is the end-state verification list. Tick only when implemented AND verified. Surface skipped items.
- Backend changes go through the backend repository's own workflow, only when the human directs them (orchestrator "Cross-Repository Concerns").

## Context notes

- The plan is a .docx: unzip, read `word/document.xml`, strip tags; tables (`w:tbl`) contain the diagrams and decision tables.
- Backend contract inspected at backend `36d0c9d`; the most consequential gaps are G4 (no session UUID for code-joined players, code released at start) and G5/G6 (single signed HTML artifact, no assets, no aspect ratio, no bridge). Tracked as CHECKLIST Z.
- The backend's own project explicitly left the frontend SDK and generated-game host out of its scope, so the bridge protocol is ours to define.
- Local Node is 22.14: React Router 8 needs >= 22.22, so React Router 7 was used (ADR-0001). TypeScript pinned to 6.0 because typescript-eslint supports < 6.1.
- pnpm is not installed; npm workspaces are used.
- Markdown is excluded from Prettier so documentation is not reformatted.
