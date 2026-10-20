# Decision Records

Status: CANONICAL PROCESS REFERENCE

Decision records preserve important historical decisions and their rationale. They do not replace canonical architecture, implementation, or work-specification documents.

## Ownership

- Decision record: historical decision plus rationale.
- Canonical knowledge: current accepted truth (`ARCHITECTURE.md`, package READMEs, `docs/architecture/*`).
- Implementation/current-state docs: what actually exists (`CURRENT_STATE.md`, code, tests).
- Work specification: approved implementation change.

```text
Discussion
    |
Human decision
    |
Decision record -------- why?
    |
Canonical knowledge ----- what is accepted now?
    |
Work specification ------ what should implementation change?
    |
Implementation ---------- what actually exists?
```

Not every small change needs every stage.

## What This Repository Records

This repository records FRONTEND architecture decisions only:

- Location: `docs/decisions/architecture/`
- Filename: `ADR-NNNN-short-kebab-title.md`
- Identifier: `ADR-NNNN`, one independent sequence for this repository, starting at `0001`. It is unrelated to the backend's `ADR-NNNN` family; when ambiguity matters in conversation, say "frontend ADR-NNNN".
- Index: `docs/decisions/architecture/INDEX.md`.

Use an ADR for significant frontend architecture: package/layer responsibility, the Game <-> Host trust boundary, bridge protocol versioning, state ownership, routing contracts, artifact/asset loading strategy, a material dependency or tooling choice that is expensive to reverse, or security posture of the game container.

Do not use ADRs for trivial implementation details.

Product decisions (PDRs), business-domain decisions, and backend contract decisions are owned by the backend repository (`../playhoot/docs/decisions/`). Do not duplicate them here; link to them.

## When To Create A Record

Persist rationale when a future engineer or AI is likely to ask "why did the frontend choose this?". Useful signals: alternatives were plausible, tradeoffs are non-obvious, consequences are durable, reversing is expensive, the rejected alternative is likely to be proposed again.

A decision reached completely in one discussion may be created directly as ACCEPTED or REJECTED. Use PROPOSED only when the proposal needs to survive across discussions before the human decides.

## Status Model

PROPOSED, ACCEPTED, REJECTED, SUPERSEDED, DEPRECATED.

- PROPOSED: not accepted, no authority, may evolve.
- ACCEPTED: explicitly approved by the human. Resulting facts must also be reflected in their canonical owners.
- REJECTED: considered and not adopted; kept only when the rationale has future value.
- SUPERSEDED: previously ACCEPTED, replaced by a specific newer record (link both directions).
- DEPRECATED: previously ACCEPTED, no longer applies, no direct replacement.

REJECTED, SUPERSEDED, and DEPRECATED are terminal. Do not introduce other statuses.

## Historical Immutability

Once ACCEPTED or REJECTED, do not substantively rewrite rationale (typo/link fixes are fine). A changed decision gets a new record, and the old one is marked SUPERSEDED with links both ways.

## One Fact, One Owner

Decision records own context, alternatives, the decision at that time, rationale, and consequences. Canonical documents own current accepted facts. Agents must not use this directory as a substitute for current truth.

## Accepted Decision Synchronization

When a decision becomes ACCEPTED:

1. Persist its rationale when it meets the threshold above.
2. Update the canonical owner(s) in the same change when practical.
3. Identify implementation impact separately. Acceptance does not mean implementation exists.

## Decision / Canonical Drift

If an ACCEPTED decision conflicts with its canonical owner, report `DECISION / CANONICAL DRIFT` (decision record, canonical owner, conflict, likely explanation, recommended resolution). Do not silently edit either side.

## Template

`docs/decisions/templates/ARCHITECTURE_DECISION.template.md`. Do not copy template-only guidance into final records.
