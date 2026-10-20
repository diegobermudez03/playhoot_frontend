# AI Workflow Changelog

Status: HISTORICAL WORKFLOW LOG

This file records APPLIED MATERIAL changes to the frontend repository's AI-assisted development workflow. It does NOT define the current workflow; current truth lives in `docs/ai/OPERATING_MODEL.md`, `docs/ai/KNOWLEDGE_MAP.md`, the processes, protocols and templates.

## Entry Shape

```text
## YYYY-MM-DD - <Short change title>

**Change**
- <what materially changed>

**Reason**
- <problem/outcome>

**Affected workflow artifacts**
- `<path>`

**Compatibility / migration**
- <impact on existing persistent artifacts, or None>
```

## 2026-10-19 - Workflow adopted from the backend repository

**Change**
- Adopted the backend repository's AI workflow (operating model, conversational orchestrator, processes/protocols, workspaces, projects, WORK, decision records, engineering radar/standards), copied from `../playhoot/docs/ai` at its state of 2026-10-19.
- Adapted for a frontend repository: repository URL; no Domain Design process (business domains are owned by the backend); a "Cross-Repository Concerns" section in the orchestrator protocol and a "Repository Scope" section in the operating model; one frontend ADR family (`docs/decisions/architecture/ADR-NNNN`), no PDRs (product decisions live in the backend); a frontend Knowledge Map.

**Reason**
- The human asked for the frontend to be set up for agentic work the same way as the backend.

**Affected workflow artifacts**
- `AGENTS.md`, `CLAUDE.md`, `docs/ai/**`, `docs/decisions/**`, `docs/projects/**`, `docs/work/**`, `docs/engineering/**`

**Compatibility / migration**
- None (new repository). Later workflow changes in the backend do not propagate automatically; port them through `docs/ai/processes/AI_WORKFLOW_CHANGE.md` when wanted.
