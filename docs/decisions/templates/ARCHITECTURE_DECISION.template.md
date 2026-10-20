# Architecture Decision Record Template

This template contains authoring guidance. Template-only instructions must not be copied into the final ADR.

Location: `docs/decisions/architecture/ADR-NNNN-short-kebab-title.md`. Determine the next number from `docs/decisions/architecture/INDEX.md`. See `docs/decisions/README.md`.

Resulting record shape:

```text
# ADR-NNNN: <Decision Title>

Status: PROPOSED
Created: YYYY-MM-DD
Last status change: YYYY-MM-DD
Supersedes: None
Superseded by: None

## Context

<What problem/pressure requires a decision?>

## Decision

<The proposed/accepted/rejected architecture outcome, appropriate to status.>

## Rationale

<Why this option was selected or why the proposal was rejected.>

## Alternatives Considered

### <Alternative>

<Material tradeoff/reason it was not selected.>

Only include meaningful alternatives.

## Consequences

<Important benefits, costs, constraints, risks, or future implications.>

## Canonical Knowledge Impact

- `<path>` - <what accepted fact changes>

For PROPOSED/REJECTED records where there is no canonical change, state None.

## Implementation Impact

<None, or concise description of downstream implementation/migration work.>

Do not place a complete implementation plan here.
```
