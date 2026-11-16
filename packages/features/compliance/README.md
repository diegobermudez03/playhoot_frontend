# @playhoot/feature-compliance

Compliance feature (logical state and ports).

Status: IMPLEMENTED: `createAcceptanceStep` (the texts a sign-in must have standing before it
continues, read at their current version and recorded one record per kind, D-037) and
`createDeclarationForm` (the residence-and-age declaration a gated function asks for, D-038).

## Owns

What a person has accepted and declared, as screen-independent state: which texts are still
missing an acceptance and recording them at the exact version shown; composing a declaration and
reading back what the backend decided (recorded, already standing, in conflict, or a place it
does not accept) and the age the place asked for.

## Does not own

- Presentation (apps/web), including the list of places a select offers.
- Whether a function is allowed anywhere: the backend's market matrix decides, and a gated
  operation's own refusal is what sends a person to the declaration.
- Where to go afterwards (the route's `next`).

## External dependencies

- zustand (vanilla store only)

## Depends on

- `@playhoot/communication`
- `@playhoot/protocol`

Architecture rules: `ARCHITECTURE.md`.
