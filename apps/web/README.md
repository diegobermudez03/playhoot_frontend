# @playhoot/web

The web host: React + TypeScript shell (plan §2, §3.1). Trusted Playhoot code.

Status: SCAFFOLD. Routes `/` and `/join/:joinCode` render placeholders. Repository-wide implementation state: `CURRENT_STATE.md` at the root.

## Owns

- App routing (React Router): the URL decides which feature is open; a direct link and a refresh rebuild the view (plan §5).
- Web presentation of each feature under `src/features/<feature>/`, including adaptive variants (portrait/compact vs landscape/wide) chosen at the presentation edge (plan §6).
- Web platform adapters: DeviceCapabilities detection for the browser, `WebGameHost` wiring (sandboxed iframe), credential persistence for the browser.
- App bootstrap wiring (plan §13.1).

## Does not own

- Feature logical state (in `packages/features/*`).
- Wire contracts (in `packages/protocol`) or transport (in `packages/communication`).
- Business rules (backend).

## Layout

```text
src/
├── main.tsx            # entry point
├── app/                # router, bootstrap, app-level routes
└── features/<feature>/ # web presentation for a feature (reads feature state, emits intents)
```

## Commands

From the repository root: `npm run dev` (http://localhost:5173), `npm run build`.
