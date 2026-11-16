# Playhoot frontend — technical entry for agents

Method, plan, product spec and current task live in the workspace one level up:
`../AGENTS.md`, `../docs/agent/METHOD.md`, `../docs/agent/STATE.md`. Read those
first. This file only holds what is specific to this repository.

## What this repository is

npm workspaces monorepo (Node >= 22.12): the web host, the GameHost that runs
untrusted games, the Game SDK and the Game <-> Host bridge. The backend
(`../playhoot`) is the business authority and owns every contract.

- `apps/web` — React host: router, presentation, platform adapters, design system, i18n.
- `packages/protocol` — HTTP paths, schemas, realtime messages, bridge contract.
- `packages/communication` — the only place that talks to the backend.
- `packages/app-core`, `packages/device` — global state and device capabilities.
- `packages/features/*` — feature state and logic, no React, no router.
- `packages/game-host`, `game-sdk`, `game-core`, `game-server`, `game-react`, `game-tools` — game runtime and SDK. The backend builds games with `game-tools` from this checkout.
- `apps/web/public/docs/sdk/v1/` — SDK guide served to creator AIs; a test keeps it aligned with the SDK.

## Architecture rules

- Three layers. Presentation renders state and forwards UI events, holding only UI
  state. Feature state is the single logic layer. `communication` makes external
  calls. Presentation never calls a client directly.
- Business logic belongs to the backend; the frontend does not re-implement it.
- Each screen has two presentation implementations, horizontal and vertical,
  chosen at the route edge and sharing components; each is also responsive.
- The URL fully determines the screen and its input. Leaving a route discards its state.
- React Router runs in framework mode (`apps/web/src/routes.ts`). Public pages are rendered by the
  server and carry their language in the path (`/es`, `/en`, `/pt`); link to them with
  `useLocalePaths()`. Everything that needs the browser hangs off `app/ClientLayout.tsx` and
  renders nothing on the server — never read `window`, storage or the services while rendering
  outside it. See D-019, D-022, D-024, D-025 and `apps/web/README.md`.
- The app is an installable PWA (D-020): `apps/web/src/pwa/`, with the worker and the offline page
  written by `apps/web/vite-pwa.ts` at build time. The worker never touches `/v1` or `/admin/v1`
  and never stores a navigation; there is no push code anywhere and never will be (P29).
- The game is untrusted: sandboxed iframe, no network, no tokens, no socket;
  everything goes through the versioned, validated bridge.
- Frontend visibility never replaces backend authorization.
- Package boundaries are enforced by lint; do not weaken them.
- Backend values are never treated as closed lists.

## Standards

- `docs/engineering/standards/` (backend contract values, user-facing text).
- i18n: no literal text in JSX or props (lint); `es`, `en`, `pt-BR` catalogs kept in
  parity (test); complete ICU sentences; feature state exposes kinds, never text;
  never show a backend `message`.
- Styles: CSS Modules and tokens only; no raw colors, durations or shadows in components.
- Assets: register in `apps/web/src/assets/assets.json`, use by id, give a
  placeholder while missing, document in `docs/design/ASSETS.md`. The creator
  sources the files.
- Accessibility target: WCAG 2.2 AA for navigation and management screens.
- The current visual identity (dark "game night", owl mascot) is being replaced
  in milestone H2. Do not extend it.

## Commands

From the repository root: `npm install`, `npm run dev`, `npm run typecheck`,
`npm run lint`, `npm test`, `npm run build`. Run **`npm run check`** (typecheck,
lint, format check, tests, asset registry) before every commit.

## Historical decisions

`docs/technical-decisions/` keeps the accepted ADRs as a record of why the
frontend is the way it is. They are history, not current truth; new decisions go
to `../docs/agent/DECISIONS.md`. The system documentation site
(`../docs/system/index.html`; this repo's data in `docs/system/`) describes what
exists.
