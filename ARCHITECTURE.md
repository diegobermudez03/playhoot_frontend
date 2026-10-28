# Architecture

Status: CANONICAL

## Scope

This document owns the accepted architecture rules and boundaries of the Playhoot frontend. It is the durable, Markdown owner of the decisions in the architecture plan (`docs/Playhoot_Frontend_Architecture_Plan.docx`, referenced as §N), which remains the full rationale and skeleton. It does not own implementation progress (`CURRENT_STATE.md`), project planning (`docs/projects/`), backend contracts (`docs/architecture/BACKEND_CONTRACT.md` mirrors them; the backend owns them), or package-local detail (package READMEs).

## System Shape (§3)

```text
            PLAYHOOT PLATFORM (trusted)
   Web Host                         Mobile Host (later)
   React + TypeScript               React Native + Expo
     ├── routing / state              ├── routing / state
     ├── HTTP / WebSocket             ├── HTTP / WebSocket
     └── WebGameHost                  └── NativeGameHost
          sandboxed iframe                 restricted WebView
                 └──────────────┬──────────────┘
                                ▼
                 SAME GAMEVERSION FRONTEND ARTIFACT (untrusted)
                 React/TS → HTML/JS/CSS bundle + Playhoot Game SDK
                                │ versioned message bridge
                                ▼
                         trusted Host → Backend
```

## Invariants (§20)

1. The backend is the authority for business rules and Session state.
2. The Playhoot Host is trusted; the generated Game frontend is untrusted.
3. The GameVersion frontend artifact is the same on web and mobile.
4. The Game depends on the Playhoot Game SDK and web standards, never on Host React DOM/React Native internals.
5. The Game never receives tokens, the real WebSocket, or direct backend access.
6. All Game <-> Host communication crosses a versioned, validated bridge. The Host validates every message, even from the official SDK; the SDK is not a trust boundary.
7. The Playhoot platform is responsive/adaptive; the Game renders in a fixed-aspect logical viewport that the Host fits, centers and letterboxes, never stretches.
8. Adaptive presentation uses separate variants chosen at the presentation edge, not layout conditionals scattered through one view.
9. Presentation local state, Feature logical state, and App Global State are distinct responsibilities.
10. Feature State knows semantic operations, not concrete transports.
11. The URL/deep link determines navigation; a feature can be rebuilt from URL + backend.
12. Leaving a route discards its feature-local state by default; returning rebuilds instead of reviving stale memory.
13. Device awareness stays in presentation and platform adapters, except capabilities that are real business inputs.
14. Frontend visibility never replaces backend authorization.
15. The first goal is a complete Join Session + Session Play vertical slice, not abstract infrastructure without a working user path.

## Repository Layout (§3.3)

Organized by application and by feature/capability, not by a global `screens` folder.

```text
apps/
  web/                      # React web shell, routing, web presentation + platform adapters
  mobile/                   # React Native/Expo shell (not started; plan step 11)
packages/
  app-core/                 # app-global contracts/state/bootstrap
  protocol/                 # shared API / realtime / bridge message contracts + runtime validation
  communication/            # HTTP/WS clients, credential-aware transport, SessionClient
  device/                   # DeviceCapabilities + display abstraction
  game-host/                # GameHost abstraction + shared bridge logic + viewport math
  game-sdk/                 # API exposed to the generated game (bundled into game artifacts)
  features/
    session-join/           # feature logical state + ports
    session-play/
    session-host/           # the creator's side of a Session (admin connection)
    sign-in/                # becoming someone the backend accepts (guest; accounts later)
fixtures/
  games/                    # small real game artifacts for end-to-end work
```

Placement rules (interpretation of §3.3 and §4, recorded so it is applied consistently):

- A feature package (`packages/features/<feature>`) holds the feature's logical state/controller and the ports it calls. It is platform-agnostic and may be reused by the mobile app.
- A feature's presentation lives in each app (`apps/web/src/features/<feature>/`), because presentation is platform-specific (React DOM vs React Native).
- Packages never import an app, a platform renderer (`react-dom`, `react-native`) or a router. Lint-enforced.
- `game-sdk` imports only `@playhoot/protocol/bridge` and no UI framework. Lint-enforced.

## Layers Inside A Feature (§4)

```text
Presentation            renders; owns presentation-only state (input text, focus, open modal, tab, animation)
   │ reads state / emits intents (join, retry, command, leave, ...)
   ▼
Feature State           lifecycle + data the feature needs; orchestration only, no business rules
   │ calls typed semantic operations
   ▼
Communication ports     HTTP / WebSocket / platform adapters; credentials attached automatically
   ▼
Backend / device / host capabilities
```

- No service/use-case layer re-implementing backend logic (§4.2).
- Feature State does not know whether an operation uses fetch, a WebSocket, postMessage or a native bridge.
- Communication translates transport/protocol failures into typed results; the feature decides how to represent them.
- App Global State holds only truly global things: auth/identity snapshot, visibility capabilities, app-level config (§4.4). Not each feature's state.

## Navigation (§5)

The URL is navigation state. A direct link and a refresh must work. Only navigation/shareable values go in the URL; never tokens or secrets. Mobile mirrors the same contract as deep links.

URLs are owned and composed by the frontend from backend identifiers; the backend never returns URLs (ADR-0002). Every Session URL is shareable and connects directly:

| Route | Connects through |
| --- | --- |
| `/join` | nothing: the Enter a code screen, for someone without a link |
| `/join/:joinCode` | the join code |
| `/sessions/:sessionUUID/play` | the Session UUID, as a player |

A code join replaces its URL with the UUID route once the Session UUID is known, so refresh and reconnection work after the start.

There is no home page yet; it will be one of the last features built. Until then `/` only redirects to `/join`, and nothing should be built on the assumption that the code entry is the home page.

## Game Frontend And GameHost (§8-§11, §16)

- A GameVersion frontend is an immutable, versioned web artifact (compiled; never raw TSX at runtime). The backend game script never reaches the browser; the game receives only its PlayerProjection and scoped events/responses.
- `GameHost` lifecycle: load artifact → isolated container → versioned bridge → READY handshake → projection/events/input → resync/reload → dispose on route/session end.
- Web: iframe with a minimal sandbox (conceptually `allow-scripts` only) plus restrictive CSP/origin strategy. Mobile: restricted WebView.
- The Host owns SAMPLE sequence, COMMAND idempotency tokens, view revision/baseline and resync mechanics; games do not reimplement protocol.
- Assets are referenced by logical keys and resolved by the Host; signed URLs and credentials stay in the Host.
- Pointer/touch positions are normalized to the logical game viewport.
- Bridge v1 and artifact loading (ADR-0005): `postMessage` objects marked `playhoot.bridge`; the game announces its bridge versions in `ready` and the Host answers `start` with the newest common one; the Host sends whole projections and translates acks into the game's own sample ids; command tokens and connection sequences never reach the game. The Host fetches the artifact without credentials, verifies its SHA-256, caches it by hash, and runs it in a `sandbox="allow-scripts"` iframe through `srcdoc` with a no-network Content-Security-Policy placed first in its head. Platform containers live in each app (web: `apps/web/src/platform/iframeGameContainer.ts`).

## Errors And Observability (§17)

Errors are distinguished by origin: presentation, bridge/contract, transport, backend logical rejection, artifact/GameHost. Measure from the start at least: artifact load time, time to GameHost READY, reconnect count, bridge validation failures, WS disconnects, resync count, artifact errors.

## Tooling

`docs/decisions/architecture/ADR-0001-workspace-tooling-for-the-frontend-foundation.md` (ACCEPTED): npm workspaces with source-consumed TypeScript packages, Vite, TypeScript strict, React Router, Vitest, ESLint + Prettier; Zustand and a runtime validator (zod proposed) when first needed.

## Deliberately Open (§19)

Bundler/pipeline of game artifacts; Host styling/design system; exact aspect-ratio list; safe asset handle shape; final Game SDK schema and names; bootstrap/me endpoint; per-platform credential persistence (web: `localStorage`, decided 2026-10-20); interpolation/prediction helpers; how much presentation is shared between web and mobile. Decide them when implementation gives real information, through the owning process.
