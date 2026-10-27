# WORK-0004: Google sign-in on the web

Status: PLANNED
Created: 2026-10-25
Last status change: 2026-10-25

Related decisions:
- The decisions of WORK-0001 and of the backend's WORK-0056

Canonical context:
- `../playhoot/plans/identity/05_Playhoot_Plan_de_Identidad_Basica.docx` (§4 "Google mediante redirección")

## Outcome

Sign-in with the real Google provider from the web: full-page navigation to Google (no widget or login iframe in the shell), completion on return without tokens in the URL, and the cancelled, failed-verification and transient-failure cases told apart. Declaring Google login available needs it verified against the real provider (plan §9).

## Context

With the refresh token held by the client, the backend cannot finish the login by setting a cookie; the human accepted on 2026-10-27 (backend WORK-0056) a one-time code in the return URL, exchanged with a verifier the client generated and kept in `sessionStorage` with the intended path.

## Scope

Not yet designed.

## Blockers

- WORK-0003; backend WORK-0060.
