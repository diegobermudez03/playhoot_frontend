# Project: Game Creation Web v1

Status: ACTIVE
Created: 2026-11-01
Last updated: 2026-11-01

## Goal

The frontend side of the game creation flow (`../docs/04_Playhoot_Plan_del_Flujo_de_Creacion.docx`, deliveries 0-3 of §13; SDK contract in `../docs/03_Playhoot_Plan_del_SDK.docx`): the Playhoot SDK packages and build tools that turn an authored TypeScript project into a backend script and a single-file frontend, the authoring workspace, the preview, publishing and remix UI, and the creation guide for AI agents.

The backend counterpart is `../playhoot` Project `game-creation-v1`, which also records the decisions taken in conversation on 2026-11-01. The human directs each step in conversation; `CHECKLIST.md` tracks what is required and done.

## Explicitly Out Of Scope

- SDK deliveries for cards/boards, didactic simulation and 2D world (plan deliveries 4-6), and launch closure: later projects.
- Playhoot's own AI, automatic screenshots, autonomous template search.

## Key Decision For The SDK (2026-11-01)

The human's criteria: few tokens to write a game, few AI mistakes and iterations, easy for an AI to write. The agent owns the SDK's exact shape within them. Consequences already decided: backend handlers may mutate the state they receive; top-level code is only functions and constants (literals, object/array literals, functions, SDK definition calls), checked by the backend's scriptcheck profile `sdk-v1` and frozen once at load; the manifest is generated from `defineGame`, never hand-written.

## Completion Criteria

Every CHECKLIST item done or explicitly moved out by the human, together with the backend project's completion criteria.
