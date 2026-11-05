# Project: Game Creation Web v1

Status: ACTIVE
Created: 2026-11-01
Last updated: 2026-11-05

## Goal

The frontend side of the game creation flow (`../docs/04_Playhoot_Plan_del_Flujo_de_Creacion.docx`, deliveries 0-3 of §13; SDK contract in `../docs/03_Playhoot_Plan_del_SDK.docx`): the Playhoot SDK packages and build tools that turn an authored TypeScript project into a backend script and a single-file frontend, the authoring workspace, the preview, publishing and template UI, and the creation guide for AI agents.

**Realignment (the human, 2026-11-05).** The creation flow must now satisfy `../docs/08_Playhoot_Checklist_Flujo_de_Creacion.md` (letters point to its sections), which wins over the plan and over earlier decisions where they conflict; product context in `../docs/06_...docx` (Playhoot + Education) and `../docs/07_...docx` (integrated AI costs). For this repository that means: a guide an agent reads in small pieces (capability index, labelled rules, SDK-versioned), patches and diffs in the workspace, scenarios with expectations, a structured game brief, configurable templates (values with a schema instead of code changes), templates taken from published games, and compact build diagnostics with codes.

The backend counterpart is `../playhoot` Project `game-creation-v1`, which records every decision taken in conversation (including the 2026-11-05 realignment and the template model). The human directs each step in conversation; `CHECKLIST.md` tracks what is required and done.

## Explicitly Out Of Scope

- SDK deliveries for cards/boards, didactic simulation and 2D world (plan deliveries 4-6), and launch closure: later projects. They provide the capabilities behind most template families and composable modules (checklist AM, E3).
- Playhoot's own AI agent, automatic screenshots, teacher product layer.
- Template marking, featuring and discovery UI (step 2 of templates, a later project).

## Key Decision For The SDK (2026-11-01)

The human's criteria: few tokens to write a game, few AI mistakes and iterations, easy for an AI to write. The agent owns the SDK's exact shape within them. Consequences already decided: backend handlers may mutate the state they receive; top-level code is only functions and constants (literals, object/array literals, functions, SDK definition calls), checked by the backend's scriptcheck profile `sdk-v1` and frozen once at load; the manifest is generated from `defineGame`, never hand-written. Added 2026-11-05: what a template lets an author change without touching code is declared configuration with a schema (checklist F).

## Completion Criteria

Every CHECKLIST item done or explicitly moved out by the human, together with the backend project's completion criteria.
