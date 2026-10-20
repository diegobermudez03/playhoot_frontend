# @playhoot/web

The web host: React + TypeScript shell (plan §2, §3.1). Trusted Playhoot code.

Status: JOIN SESSION: Enter a code at `/join` (`/` redirects there; no home page yet), Join Session on both Session URLs (ADR-0002), design system and a dev-only style guide at `/design`; WebGameHost (sandboxed iframe container, artifact cache) exercised by the dev-only GameHost lab at `/dev/game-host`. Repository-wide implementation state: `CURRENT_STATE.md` at the root.

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
├── app/                # composition root (services.ts), React bindings, router, app-level routes
├── platform/           # browser adapters: credential storage, device capability detection,
│                       #   WebGameHost container (sandboxed iframe + CSP), game artifact cache
├── ui/                 # design system (proposal): tokens.css + components, docs/design/DESIGN_SYSTEM.md
├── dev/                # development-only tools: /design style guide, test-account picker,
│                       #   /dev/game-host lab (fixture game + fake Session)
└── features/<feature>/ # web presentation for a feature (reads feature state, emits intents)
```

## Local development against the backend

The dev server proxies `/v1` (REST and WebSocket) to `PLAYHOOT_BACKEND_URL` (default `http://localhost:8081`; override in `apps/web/.env.local`, see `.env.example`). The browser only talks to `localhost:5173`, so the backend needs no CORS, and since the proxy keeps the Host header the backend's WebSocket origin check sees Origin == Host. Start the backend as described in `docs/architecture/BACKEND_CONTRACT.md` §7.

To try the GameHost and the Game SDK without a backend: `npm run fixtures` once (builds `fixtures/games/space-drift`), then open http://localhost:5173/dev/game-host. The dev server serves built fixtures at `/__fixtures/games/<game>/`.

To play through a Session without a host UI: `node scripts/dev-host.mjs` creates one as `test-user-1`, prints the join link, and starts it when you press Enter. Every guest is the same user in the backend's placeholder Identity, so a second player on the same machine uses the dev "Test user 2" button in a private window.

## Commands

From the repository root: `npm run dev` (http://localhost:5173), `npm run build`.
