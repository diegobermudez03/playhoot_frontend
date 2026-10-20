# Project: Session Play v1 (web vertical slice)

Status: ACTIVE
Created: 2026-10-19
Last updated: 2026-10-19

## Goal

Deliver the first web vertical slice of the frontend architecture plan (`docs/Playhoot_Frontend_Architecture_Plan.docx`, §18 steps 1-10): a user opens a join link directly, resolves identity, establishes the Session, loads the GameVersion frontend artifact in an isolated container, plays through SAMPLE/COMMAND, receives projections/events, tolerates a short disconnection, and rebuilds from route + backend without depending on earlier page memory (plan §18 completion gate).

It is built on the real backend (`../playhoot`, Session Runtime already implemented), with a small real game as the end-to-end fixture. Backend changes that the slice needs (assets, session identity for reconnect, frontend metadata, CORS/origins, ...) are part of delivering this goal; they are tracked here and made in the backend repository through its own workflow.

The plan is the architectural skeleton; concrete implementation is decided step by step between the human (who directs what is implemented and in what order) and the agent (who challenges, proposes, and flags gaps).

## Explicitly Out Of Scope

- Mobile shell / NativeGameHost (plan step 11): the slice keeps shared packages portable but builds no mobile app.
- Marketplace, account/auth UI beyond what joining needs, authoring/publishing, spectator, replay playback (plan step 12).
- Creating Sessions from the UI and the admin experience (start, cancel, perspective), unless the human pulls them in: the slice is the player path. For testing, Sessions are created and started through the backend API or a dev tool.
- Real identity: the backend's Identity is a placeholder; the slice uses what exists (guest creation, fixed test tokens).

## Current Work

Repository foundation scaffolded on 2026-10-19 (structure, tooling, docs, AI workflow); see `CURRENT_STATE.md`. Plan step 1 (foundation: routing, minimal AppGlobalState, communication abstractions, DeviceCapabilities provider) is the next step, waiting for the human's direction. The backend contract was inspected and recorded (`docs/architecture/BACKEND_CONTRACT.md`), with gaps G1-G9 mapped to CHECKLIST section Z.

No WORK files exist: the human directs each step in conversation (see "Material Decisions Needing Human Input").

## Work

| Order | Work | Status |
|------:|------|--------|
| - | none yet | - |

## Ordering / Dependencies

The plan's step order (§18) is the default; the human gives the actual order. Real dependencies known now:

- Join (step 2) and the realtime client (step 3) depend on the foundation (step 1) and on a same-origin dev setup (Z1).
- WebGameHost (step 4) and the SDK (step 5) can proceed in parallel with steps 2-3 against a local fixture artifact.
- The Session Play slice (step 6) needs steps 2-5 and, to be real end to end, the backend decisions in section Z (artifact format/bridge expectations Z4, frontend URL lifetime Z3; reconnect after start needs Z2).
- Fixed-aspect viewport (step 7) needs an aspect ratio declared per GameVersion (Z5).

## Capability Coverage

The required end state is tracked in [CHECKLIST.md](CHECKLIST.md). A checkpoint is ticked only when implemented and verified (test or other evidence), not when code merely exists. When a WORK is created, it references the checklist IDs it owns; a required capability owned by nothing is reported to the human as a gap.

## Material Decisions Needing Human Input

1. **Working mode (WORK vs checklist).** `docs/projects/README.md` Invariant 1 wants a PLANNED WORK per known outcome. This project copies the backend's working mode: the CHECKLIST is the coverage matrix and WORK items are created only when the human directs. Confirm, or ask for PLANNED WORK per checklist section.
2. **Tooling (ADR-0001, PROPOSED).** npm workspaces, Vite, TypeScript 6 strict, React Router 7, Vitest, ESLint + Prettier; Zustand and zod when first used. Accept, change, or reject.
3. **Session Play URL contract.** The plan fixes `/join/{joinCode}` only. Proposal to discuss at step 2: `/join/:joinCode` for joining and `/play/:sessionUUID` for the running Session (refresh/reconnect), which needs the player to learn the session UUID (backend gap Z2).
4. **Backend gaps (section Z).** Which to fix in the backend now vs. work around for the slice: session UUID for code-joined players, frontend URL re-signing, assets and artifact format, frontend metadata in the GameVersion (aspect ratio), CORS/origins.
5. **Plan durability.** The plan exists only as a `.docx`. `ARCHITECTURE.md` now owns its invariants, layout and layer rules in Markdown; the `.docx` stays as the full skeleton. Confirm this split.

## Completion Criteria

The project is complete when every item in [CHECKLIST.md](CHECKLIST.md) is checked or explicitly moved out of scope by the human, including the completion gate (section J), observability (section K) and backend dependencies (section Z), and the durable knowledge has been promoted to its owners (`ARCHITECTURE.md`, package READMEs, `CURRENT_STATE.md`, ADRs, and in the backend repository its own docs).
