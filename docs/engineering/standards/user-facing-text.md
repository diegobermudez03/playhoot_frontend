# User-Facing Text and Languages

Status: ACCEPTED (from the human's explicit rule, 2026-10-20)

## Rule

1. The platform is multilingual. Languages: Spanish (`es`), English (`en`), Brazilian Portuguese (`pt-BR`) now; French (`fr`) planned. The list lives in `packages/app-core/src/locale.ts`.
2. No user-facing text is hardcoded in components. Every text a person reads comes from a message catalog (web: `apps/web/src/i18n/messages/`).
3. A message is a whole sentence with named placeholders, in ICU MessageFormat. Never build a sentence by concatenating pieces (`name + ", you're player " + n`): word order, connectors, plurals and grammatical agreement differ per language, and only a whole sentence lets each translation decide them.
   - Values: `{name}`, `{seat}`.
   - Plurals and choices inside the message: `{seconds, plural, one {# second} other {# seconds}}`, `{x, select, ...}`.
   - Markup as tags around the words it styles: `<b>{seat}</b>`, `<mark>{code}</mark>`. The code decides how a tag looks; the translation decides where it goes.
4. Every catalog has exactly the source catalog's ids (`en.ts`), with the same placeholders and tags. A test enforces it (`apps/web/src/i18n/catalogs.test.ts`), and message ids are type-checked.
5. Feature state and other non-presentation code never produce display text. They expose kinds and values (`{ kind: 'invalid-name', reason: 'too-long', maxLength: 64 }`); presentation turns them into messages.
6. Text from the backend (error `message` fields) is never shown as is; it is not localized. Branch on codes and kinds.
7. Numbers and dates shown to people go through the locale's formatting (`intl.formatNumber`, `formatDate`).

## Enforcement

- Lint: `formatjs/no-literal-string-in-jsx` rejects literal text in JSX and in `label`, `placeholder`, `title`, `hint`, `alt` props under `apps/web/src`.
- Test: catalog parity (ids, placeholders, tags) and ICU validity.
- Types: `formatMessage` / `<FormattedMessage>` ids must exist in the source catalog.

## Allowed exceptions

- The brand name ("playhoot") and other proper names that are the same in every language, declared as named constants.
- Development-only tools (`apps/web/src/dev/`), tests, logs, and technical error details shown for support (e.g. a route error's message).

## Adding a language

Add the tag to `supportedLocales`, its name in itself to `languageNames`, and a full catalog typed `Messages`. The parity test fails until every message is translated.
