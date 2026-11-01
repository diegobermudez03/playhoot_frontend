# WORK-0004: Google sign-in on the web

Status: IMPLEMENTING
Created: 2026-10-25
Last status change: 2026-10-31 (the human asked for it in conversation; with the backend's WORK-0060; the real Google verification waits for the human's OAuth client)

Related decisions:
- The decisions of WORK-0001 and of the backend's WORK-0056

Canonical context:
- `../playhoot/plans/identity/05_Playhoot_Plan_de_Identidad_Basica.docx` (§4 "Google mediante redirección")

## Outcome

Sign-in with the real Google provider from the web: full-page navigation to Google (no widget or login iframe in the shell), completion on return without tokens in the URL, and the cancelled, failed-verification and transient-failure cases told apart. Declaring Google login available needs it verified against the real provider (plan §9).

## Context

With the refresh token held by the client, the backend cannot finish the login by setting a cookie; the human accepted on 2026-10-27 (backend WORK-0056) a one-time code in the return URL, exchanged with a verifier the client generated and kept in `sessionStorage` with the intended path.

## Scope

Built 2026-10-31: the sign-in page asks the backend which providers it offers (`GET /v1/identity/login/providers`, `createAccountSignIn.loadProviders`) and shows only those: "Continuar con Google" enabled when Google is offered ("coming soon" otherwise), the local test account only when the backend offers it (instead of development builds). The Google button follows Google's branding guidelines, dark theme, pill shape: the unmodified "G" mark (asset `brand.google-g`, `docs/design/ASSETS.md`), Roboto Medium bundled locally (`@fontsource/roboto`, no third-party request), Google's colors. Pressing it is the same full-page sign-in as the local provider (WORK-0003). Required (decided by the human 2026-10-27, backend IDENTITY-ADR-0003 point 8 clarification; no browser-binding cookie): the one-time code must never leave the browser. The completion route removes it from the URL before loading anything else, sends no referrer, loads no third-party resources, and never sends it to client telemetry or logs.

## Blockers

- WORK-0003; backend WORK-0060.

## Review

- Independent review (2026-10-31): CHANGES_REQUIRED for one medium finding (every refusal from Google's token endpoint was an invalid answer and nothing was logged, so a misconfigured client would fail silently) and three low ones (the providers list was never retried, both provider buttons could start at once, a refetch failure discarded cached keys); all fixed: only `invalid_grant` is an invalid answer, 5xx/429 are unavailable, any other 4xx is `ErrMisconfigured` (logged, alerted, ended unavailable with reason `provider_misconfigured`), refused answers are logged without secrets, the web retries the providers list with backoff, the Google button is disabled while any sign-in starts, cached keys under 24 hours verify while Google's keys cannot be fetched, and RS256-only is locked by tests. Re-review APPROVED.

Remaining before DONE: verified against the real Google with the human's OAuth client (backend WORK-0060).
