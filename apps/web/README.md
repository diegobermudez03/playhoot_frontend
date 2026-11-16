# @playhoot/web

The web host: React + TypeScript, on React Router in framework mode (D-019). Trusted Playhoot code.

Status: JOIN SESSION: Enter a code at `/{language}/join` (`/join` redirects to the reader's language), Join Session on both Session URLs (ADR-0002), design system and a dev-only style guide at `/design`; WebGameHost (sandboxed iframe container, artifact cache) exercised by the dev-only GameHost lab at `/dev/game-host`.

## Owns

- App routing (React Router framework mode, `src/routes.ts`): the URL decides which feature is open; a direct link and a refresh rebuild the view (plan §5).
- Rendering: public pages (`/es`, `/en`, `/pt` and their `/join` and `/sign-in`) are rendered on the server with their own metadata; the home of each language is written out at build time. Everything else renders in the browser, under `app/ClientLayout.tsx`, exactly as before (D-019).
- Public metadata and addresses: title, description, canonical, hreflang alternates, Open Graph and JSON-LD (`src/seo/`), `robots.txt` and `sitemap.xml` (`src/routes/`), and the language in the path (`src/i18n/localePaths.ts`, D-022).
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
├── root.tsx            # the document (html, head, providers) around every page
├── routes.ts           # the route table: public pages per language, then the app
├── entry.client.tsx    # what runs in the browser before anything else
├── routes/             # one module per route: what it renders and how it describes itself
├── app/                # composition root (services.ts), React bindings, the client-only layout
├── seo/                # metadata every public route is described with
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

To play through a Session without a host UI: `node scripts/dev-host.mjs` signs in as an account through the backend's local provider, creates one, prints the join link, and starts it when you press Enter. Each guest is its own user (a private window or another browser context gives another guest); the backend needs `IDENTITY_DEV_TEST_USERS=true` for the script's test account.

## Deployment

`npm run build -w @playhoot/web` produces `apps/web/build/`: `client/` (everything the browser
downloads, plus the pages written out at build time) and `server/` (the render). The deployable
unit is a Node process, not a static site: `npm run start -w @playhoot/web` runs `server.js`,
which serves `build/client` and hands every other request to the render. `npm run preview -w
@playhoot/web` builds and starts it.

Requirements for wherever it runs:

- **Node.** Node >= 22.12, with `build/` and `node_modules` beside `server.js`. `PORT` chooses the
  port (3000 by default).
- **Public origin.** `PLAYHOOT_SITE_URL` is the address people use (`https://…`). Every canonical
  link, alternate, Open Graph URL and sitemap entry is built on it, and the pages written out at
  build time carry it, so it must be set **for the build as well as for the server**. Without it
  the request's own origin is used, which is wrong behind a proxy.
- **Request logs.** Nothing may log a request URL with its query: a sign-in's one-time code
  travels in one (backend IDENTITY-ADR-0003 point 8). `server.js` logs no requests; a proxy in
  front of it must not either, or must strip the query.
- **Caching.** Files whose name carries a content hash are served immutable for a year; everything
  else for an hour. Rendered pages are not cached.
- **Content-Security-Policy.** The rendered document carries `frame-src 'none'` as a meta tag
  (ADR-0006); a host adding its own CSP header must keep that directive.
- **Backend origin.** The backend's `CORS_ALLOWED_ORIGINS` and `WEBSOCKET_ALLOWED_ORIGINS` list
  this site's origin, and the storage bucket's CORS too (backend `deploy/README.md`).

## Commands

From the repository root: `npm run dev` (http://localhost:5173), `npm run build`. From this
folder: `npm run start` (serves a build), `npm run preview` (build then start).
