# ADR-0001: Workspace tooling for the frontend foundation

Status: PROPOSED
Created: 2026-10-19
Last status change: 2026-10-19
Supersedes: None
Superseded by: None

## Context

The architecture plan (`docs/Playhoot_Frontend_Architecture_Plan.docx`) fixes React + TypeScript for the web host, a Zustand-style store, React Router on web, runtime validation of bridge messages, and a monorepo of `apps/*` and `packages/*` (§2, §3.1, §3.3). It deliberately leaves the bundler, styling and other tooling open (§3.1, §19). Scaffolding the repository needed concrete choices; they were made by the agent while setting up the repository and need the human's confirmation.

## Decision

- Package manager / monorepo: npm workspaces (`apps/*`, `packages/*`, `packages/features/*`). Internal packages are consumed as TypeScript source (`exports` point at `src/index.ts`), with no per-package build step.
- Web bundler and dev server: Vite.
- Language: TypeScript 6.0 in strict mode (plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`). Not TypeScript 7 yet: typescript-eslint supports `<6.1`.
- Routing: React Router 7 (`react-router` package, data router). Version 8 requires Node >= 22.22; the local Node is 22.14. Moving to 8 is a dependency bump once Node is upgraded.
- Tests: Vitest, one root config covering every workspace.
- Lint/format: ESLint (flat config, typescript-eslint, react-hooks) and Prettier for code. ESLint also enforces the package boundaries that a lint rule can express (packages never import apps or platform renderers/routers; the Game SDK imports only `@playhoot/protocol/bridge` and no UI framework).
- Not added until used: Zustand (app-global and feature state) and a runtime validation library (proposed: zod) arrive with the first code that needs them.

## Rationale

- npm workspaces need nothing beyond the installed Node toolchain; pnpm is not installed. The repository is small, so stricter dependency isolation or task caching (pnpm, Turborepo, Nx) solves no current problem.
- Source-consumed packages avoid a build graph while every consumer is bundled by Vite (or, later, Metro/Expo). A package that must ship compiled (the Game SDK inside game artifacts) can add its own build when that work happens.
- Vite is the default React + TypeScript toolchain and also suits building small game artifacts in `fixtures/`.

## Alternatives Considered

### pnpm workspaces

Stricter, faster installs and better monorepo ergonomics. Not chosen now only because it is not installed and nothing yet needs it; switching later is cheap.

### Turborepo / Nx

Task orchestration and caching. Not needed at this size.

## Consequences

- Every package must stay importable as TypeScript source by every bundler that consumes it (Vite now, Expo later).
- Lint-enforced boundaries make the Game SDK isolation visible in CI, not only in review.

## Canonical Knowledge Impact

- `ARCHITECTURE.md` - "Tooling" section lists these choices as proposed until this ADR is accepted.

## Implementation Impact

Already scaffolded this way (2026-10-19). Rejecting any part means changing the scaffold.
