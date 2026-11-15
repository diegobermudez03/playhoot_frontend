# ADR-0004: Internationalization with FormatJS and ICU messages

Status: ACCEPTED
Created: 2026-10-20
Last status change: 2026-10-20
Supersedes: None
Superseded by: None

## Context

The human required the platform to switch between Spanish, English, Portuguese and, later, French, with no hardcoded text and no sentences assembled from fragments, because word order and connectors change per language (2026-10-20). The rule itself is accepted (`docs/engineering/standards/user-facing-text.md`); the mechanism needed choosing. The human asked the agent to apply the existing patterns for this.

## Decision

- Messages use **ICU MessageFormat**, the industry standard for whole-sentence messages with named placeholders, plurals, selects and markup tags.
- The web host uses **FormatJS** (`react-intl`): `IntlProvider` at the root, `FormattedMessage` / `useIntl().formatMessage` in components, rich-text tags (`<b>`, `<mark>`) rendered by the host.
- Catalogs are TypeScript modules per language in `apps/web/src/i18n/messages/`; `en.ts` is the source and its keys type every message id. A test checks every catalog has the same ids, placeholders and tags.
- The current language is app-global state (`packages/app-core`): the person's saved choice, else the best match among the device's languages (`pt-PT` → `pt-BR`, `es-CO` → `es`), else English. The choice is persisted per platform (web: `localStorage`). A language picker is in the top bar of every page; `<html lang>` follows it.
- Portuguese is Brazilian Portuguese (`pt-BR`).
- All catalogs are bundled (no lazy loading) while they are small.

## Rationale

- ICU is supported across platforms and translation tools, so translators (or a translation service) can work on the catalogs without code.
- FormatJS is the reference ICU implementation for React. Its core (`@formatjs/intl`) runs without React, so the future React Native app can use the same catalogs and approach.
- Typed ids plus the parity test turn missing or broken translations into build failures instead of runtime surprises.

## Alternatives Considered

### i18next (react-i18next)

Very popular, with a large plugin ecosystem. Its default interpolation is not ICU, and plurals are separate keys per form; ICU needs an extra plugin. FormatJS is ICU-native.

### Lingui

Excellent developer experience with ICU and extraction, but relies on compile-time macros and a build step. Reconsider if catalogs become large and extraction from source is wanted.

### Hand-rolled templates

Rejected by the rule: no plurals, no grammar, and the concatenation the human ruled out.

## Consequences

- Every new screen adds messages to all catalogs in the same change (the parity test fails otherwise).
- English is the fallback language for unsupported devices. Spanish could be chosen instead if the main audience is Spanish-speaking (product decision).
- Bundle size grows with catalogs; split per language if it starts to matter.

## Canonical Knowledge Impact

- `docs/engineering/standards/user-facing-text.md` (the rule this implements).
- `docs/design/DESIGN_SYSTEM.md` (language picker, voice per language).

## Implementation Impact

Implemented 2026-10-20 for every existing screen.
