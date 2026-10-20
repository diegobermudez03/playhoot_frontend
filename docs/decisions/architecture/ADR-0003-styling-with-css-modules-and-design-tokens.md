# ADR-0003: Styling with CSS Modules and design tokens

Status: ACCEPTED
Created: 2026-10-20
Last status change: 2026-10-20
Supersedes: None
Superseded by: None

## Context

The Join Session screens are the first Playhoot UI and set the visual identity (`docs/design/DESIGN_SYSTEM.md`). The plan leaves the styling library and design system of the Host open (§19). The agent needed a styling approach to build the proposal. The human approved the result and asked for it to stay reusable and driven by global variables (2026-10-20).

## Decision

- Design tokens are CSS custom properties on `:root` (`apps/web/src/ui/tokens.css`): palette, semantic colors, type, radii, spacing, depth, motion. Components use semantic tokens.
- Components are styled with CSS Modules (`*.module.css`), next to each component.
- Web components live in `apps/web/src/ui/` (presentation is platform-specific); a future mobile app would mirror the tokens, not import these components.
- Fonts are self-hosted with `@fontsource-variable/fredoka` and `@fontsource-variable/nunito`.
- No CSS-in-JS, utility framework or component library for now.

## Rationale

- Vite supports CSS Modules natively: no dependency, no runtime cost, no build step to learn.
- Custom properties make retheming (palette changes during design iteration, a light theme later) a token change.
- Self-hosted fonts avoid third-party requests and keep a future strict CSP simple.

## Alternatives Considered

### Tailwind CSS

Fast to iterate and popular, but adds a build dependency and puts the visual language in class strings across every component; the tokens would still need defining. Reconsider if the team prefers utility classes.

### A component library (Radix/shadcn, MUI, Mantine)

Gives accessible primitives for menus, dialogs and similar. Not needed for the current screens (buttons, fields, cards). Reconsider when complex interactive components appear; unstyled primitives such as Radix would fit this approach.

### CSS-in-JS (styled-components, Emotion)

Runtime cost and SSR/streaming caveats, with no advantage here over CSS Modules plus custom properties.

## Consequences

- Shared values must be tokens; components must not hardcode colors (the owl illustration's own colors are the exception).
- Complex accessible widgets will need either hand-built components or a primitives library later.

## Canonical Knowledge Impact

- `docs/design/DESIGN_SYSTEM.md` (proposal) describes the tokens and components.
- `ARCHITECTURE.md` "Deliberately Open" item "styling/design system of the Host" would point here once accepted.

## Implementation Impact

Join Session (2026-10-20) is built this way.
