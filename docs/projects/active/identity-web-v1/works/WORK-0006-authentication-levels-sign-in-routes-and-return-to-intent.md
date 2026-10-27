# WORK-0006: Authentication levels, sign-in routes and return to intent

Status: PLANNED
Created: 2026-10-27
Last status change: 2026-10-27

Related decisions:
- The decisions of WORK-0001
- Backend: WORK-0062 (operation authentication levels catalog)

Canonical context:
- `docs/logic/FLOWS.md` (flows 1, 3, 10)
- `docs/engineering/standards/backend-contract-values.md`
- `docs/projects/active/session-play-v1/CHECKLIST.md` section L (moved here)

## Outcome

One global pattern, decided by the human on 2026-10-27, for when and how a person is asked to authenticate:

- At startup the client reads the backend's operation catalog (`GET /v1/identity/operations`, each operation's minimum level on `anonymous < guest < account`) in parallel with restoring its credential, which gives its own level.
- Operations above the person's level may still be shown. Choosing one redirects to the most flexible authentication the operation allows, carrying the intended internal path (`next`): an operation allowing guests goes to the guest page (name to play, plus a "Sign in / Create account" option that keeps `next`); an operation requiring an account goes to the sign-in page. After success the person continues to `next`, already authenticated (across the Google redirect too).
- `/sign-in` is the definitive sign-in and registration route (with Google only they are the same action); for now it is nearly empty (testing). The guest page is its own route.
- A corner button on every screen: anonymous, "Sign in / Sign up" to `/sign-in` with the current path as `next`; guest, their name plus "Sign in" (the sign-in page warns that switching to an account does not carry the guest's participations, plan §3); account, their name with a minimal menu with "Sign out" (no profile page in this project).
- Join no longer asks the name inline: a join link without identity goes to the guest page and comes back to the join.
- A minimal "Create Session" button requiring an account (human's choice, closing PROJECT.md decision 2): with an account it creates a Session of the test game and takes the person to it; without one it goes through `/sign-in` and back.

## Context

Today the name step lives inside the Join feature (flow 3) and the app trusts the stored credential without any call at startup (flow 1). The plan's internal-destination rule applies to `next` (only internal paths). Visibility is never authorization: the backend still decides every operation. Unknown operations or levels in the catalog are treated as `account`, the strictest known level. Route names are proposals (`/sign-in`, `/sign-in/guest`) to confirm in DRAFT.

## Scope

Not yet designed. "Create Session" sends a game UUID hardcoded in the frontend for now (placeholder) and leads to the host experience, which the human pulled into `session-play-v1` on 2026-10-27 (its CHECKLIST P) to be built together with this WORK.

## Blockers

- WORK-0001; backend WORK-0062. The guest and account completions need WORK-0002 and WORK-0003; the catalog-driven redirection can be built first against the current placeholders.
