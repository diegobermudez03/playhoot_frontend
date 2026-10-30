# WORK-0003: Account sign-in with the local provider

Status: DONE
Created: 2026-10-25
Last status change: 2026-10-27 (the human said to continue in conversation, under the working agreement; done with the backend's WORK-0059)

Related decisions:
- The decisions of WORK-0001

Canonical context:
- `../playhoot/plans/identity/05_Playhoot_Plan_de_Identidad_Basica.docx` (§3 "Conversión futura", §9, §10 "Fronteras de implementación")
- `docs/design/DESIGN_SYSTEM.md`, `docs/design/ASSETS.md`

## Outcome

Accounts usable locally against the backend's simulated provider: the sign-in entry ("Continue with Google"), the guest name step, restoration state, minimal visible identity, logout and error recovery, in the existing languages; the explicit identity switch from a guest, warned before it starts (participations are not transferred; cancelling keeps the guest); return after sign-in limited to internal destinations, keeping the navigation's purpose; `DevIdentityPicker` and `dev-host` moved to the real backend flow, with no magic test tokens left (plan §10 stage 3).

## Context

New visual assets (for example the Google button mark, following Google's branding rules) are registered in `apps/web/src/assets/assets.json` and documented in `docs/design/ASSETS.md`.

## Scope

Built: `createAccountSignIn` in `@playhoot/feature-sign-in` (start keeps an S256 verifier and `next` in this tab's sessionStorage and sends the whole page to the provider; completion exchanges the one-time code with the verifier and hands over the guest in use); `/sign-in/complete`, whose code is read and removed from the URL by the first module the app evaluates (`apps/web/src/captureSignIn.ts`), before the router or anything else sees it; `<meta name="referrer" content="no-referrer">`; the sign-in page offers the local provider in development builds ("Cuenta local de prueba"), Google stays disabled; errors in three languages; `DevIdentityPicker` deleted and `scripts/dev-host.mjs` signing in through the local provider. The guest warning stays the notice shown on the sign-in page before starting. The Google button mark and its assets belong to WORK-0004. PROJECT.md decision 2 is answered by this: a persisted account creates the Session.

## Blockers

None.

## Amendment (2026-10-29, decided by the human in conversation)

An account no longer gets a name from the provider: it starts without one and the person chooses it after signing in. The root layout shows the name screen (`DisplayNameScreen`, `createDisplayNameSetup`) instead of any page while the account has no display name, reloads included, and the page appears once the name is kept (`PUT /v1/identity/me/display-name`, then the access token renewed). Verified in headless Edge: a new account asked its name, still asked after a reload, then continued to `next`.

## Completion Record

- Implementation: `packages/protocol/src/http/guests.ts`, `packages/communication/src/identityClient.ts` (`startLogin`, `completeLogin`), `packages/app-core/src/appState.ts` (`currentRefreshToken`), `packages/features/sign-in/src/accountSignIn.ts`, `apps/web/src/platform/{pendingLogin,signInCompletion}.ts` (SHA-256 in script where `crypto.subtle` is missing: plain HTTP on the local network), `apps/web/src/{captureSignIn.ts,main.tsx}`, `app/{services.ts,router.tsx}`, `features/sign-in/{SignInRoute,SignInCompleteRoute}.tsx`, messages.
- Verification: `npm run check` (28 files, 247 tests); headless Edge against the real backend: a guest in a lobby switching to an account (continued to `next`, the code gone from the URL, the guest's refresh refused afterwards), cancelling at the provider, the same name in another browser being the same account, reload; the host flow (28 checks) and the guest flow (11) signing in through the local provider.
- Independent review: APPROVED, with low findings: the router read the one-time code before it left the URL (fixed: the capture is the first module the web app evaluates); the local provider was refused only in production while IDENTITY-ADR-0003 point 2 says local and test only (fixed: only `development`, `local` or `test` environments); repository tests missing for the callback and completion repos (added); the sign-in button could stay loading after Back from the provider (fixed in the frontend). Accepted as is: raw SQL inserts ("prefer" `Create()`), and a lost completion response: the server already ended the guest's session and opened the account's, so the client, which never got the account, ends signed out and signs in again (a single-use code cannot be replayed, by design).
- Docs: `CURRENT_STATE.md`, `docs/architecture/BACKEND_CONTRACT.md` (G3, login endpoints, manual flow), `docs/logic/` (calls table, flow 15, mirror `view_sign_in.go`, new `view_sign_in_complete.go`, `routes.go`, `external.go`, README table), `apps/web/README.md`, the feature README.
