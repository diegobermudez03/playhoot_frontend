# AI Agent Bootstrap

This file is the entry point for AI agents working on the Playhoot FRONTEND.

Before performing non-trivial work:

1. Determine your execution surface: CONVERSATIONAL AI, CODEBASE AGENT, or
   INDEPENDENT REVIEWER. If you have effective access to this repository
   checkout and can inspect/modify files, run commands, and persist workflow
   artifacts, you are acting as a Codebase Agent (or, when reviewing
   read-only, an Independent Reviewer). Role definitions and authority live in
   `docs/ai/OPERATING_MODEL.md` — do not redefine them here.
2. Read `docs/ai/OPERATING_MODEL.md`.
3. Use `docs/ai/KNOWLEDGE_MAP.md` to identify and load only the context
   relevant to the task.
4. For a normal natural-language request, use
   `docs/ai/protocols/CONVERSATIONAL_ORCHESTRATOR.md` before forcing the
   human to choose a process: search for a matching open Project, initiative
   or WORK first, then select the internal process that owns the concern.
   Skip straight to the matching process/protocol only when clearly resuming
   a known persisted process.
5. If a process runbook exists for that type of work, use
   `docs/ai/processes/*` as the human-facing guide and follow the matching
   `docs/ai/protocols/*` execution protocol.
6. Inspect actual code and tests whenever current implementation behavior
   matters.
7. Do not silently resolve contradictions between canonical documentation and
   implementation. Report them as drift.
8. Do not treat ideas, proposals, examples, TODOs, or future-looking
   documentation as accepted decisions.
9. Understand the product/business reason for material changes before
   implementing them.
10. Escalate material product, architecture, security, contract, dependency,
    or engineering-standard decisions instead of inventing them during
    implementation.
11. Do not scan every Markdown document by default. Load context through the
    Knowledge Map.

## Two Repositories

The backend lives in the sibling checkout `../playhoot`
(`https://github.com/diegobermudez03/playhoot`) and has its own `AGENTS.md`
and workflow. The backend is the business authority and owns every
client-facing contract. This repository owns the web/mobile hosts, the
GameHost, the Game SDK and the Game <-> Host bridge.

- To know what the backend actually exposes, start from
  `docs/architecture/BACKEND_CONTRACT.md`, then verify in backend code.
- When frontend work needs a backend change, follow "Cross-Repository
  Concerns" in `docs/ai/protocols/CONVERSATIONAL_ORCHESTRATOR.md`. Never
  change the backend without the human directing it; when you do, follow the
  backend's own `AGENTS.md`.

## Project Status

The repository was scaffolded on 2026-10-19 from the architecture plan
`docs/Playhoot_Frontend_Architecture_Plan.docx` (the "plan"; `§N` references
point to its sections). The active Project is
`docs/projects/active/session-play-v1/`: the first vertical slice (open a
join link, join, play a Session). `CURRENT_STATE.md` says what actually
exists.

The plan is a `.docx`. To read it, extract `word/document.xml` from the zip
(e.g. with Python `zipfile`) and strip tags; tables and diagrams are inside
`w:tbl` elements.

## Engineering Standards

Canonical reusable engineering standards live under
`docs/engineering/standards/` (index: `INDEX.md`). Do not infer new
standards from recurring implementation patterns; use the Engineering
Standard process.

## Commands

From the repository root (npm workspaces): `npm install`, `npm run dev`,
`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and
`npm run check` (typecheck + lint + format check + tests). Run `npm run check`
before reporting implementation work as done.

## Human Review And Temporary Context

For non-trivial AI process checkpoints, `HUMAN_REVIEW.md` is the normal human
review surface.

`AI_CONTEXT.md` is temporary resumable agent context only. It is not canonical
truth, not implementation authority, and must not contain hidden material
decisions.

When acting as CODEBASE AGENT or INDEPENDENT REVIEWER, respect existing active
workspaces under `docs/ai/workspaces/active/` and active Projects under
`docs/projects/active/`: do not overwrite their design authority, and keep
their `AI_CONTEXT.md` resume state current at meaningful repository-side
checkpoints so an interrupted execution can be resumed. See
`docs/ai/workspaces/README.md`.
