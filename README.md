# Playhoot Frontend

Web host, GameHost, Game SDK and shared packages for Playhoot. The backend lives in a separate repository: [playhoot](https://github.com/diegobermudez03/playhoot).

- Architecture: [ARCHITECTURE.md](ARCHITECTURE.md)
- What exists, screens and their calls: the system documentation site (`../docs/system/index.html`; this repo's data in `docs/system/`)
- Past technical decisions: [docs/technical-decisions/](docs/technical-decisions/)
- What the backend exposes: [docs/architecture/BACKEND_CONTRACT.md](docs/architecture/BACKEND_CONTRACT.md)
- Working with AI agents: [AGENTS.md](AGENTS.md)

## Requirements

Node >= 22.12 and npm.

## Commands

```sh
npm install
npm run dev        # web app at http://localhost:5173
npm run check      # typecheck + lint + format check + tests
npm run build      # production build of the web app
node scripts/dev-host.mjs   # dev: create + start a Session on the local backend
```

Design proposal: [docs/design/DESIGN_SYSTEM.md](docs/design/DESIGN_SYSTEM.md); live style guide at http://localhost:5173/design while `npm run dev` runs.

## Layout

```text
apps/web            React web shell
packages/*          app-core, protocol, communication, device, game-host, game-sdk
packages/features/* feature logical state (session-join, session-play, ...)
fixtures/games      small game artifacts for end-to-end work
scripts/            development tools
docs/               architecture, decisions, projects, AI workflow
```
