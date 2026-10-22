# @playhoot/game-host

GameHost abstraction and shared bridge logic.

Status: MINIMAL HOST (plan step 4, ADR-0005): artifact loading with hash verification and cache, READY handshake with version negotiation, validation of every game message, projection/events/ack forwarding, SAMPLE/COMMAND/asset translation, typed failures, timings; a new connection (`open` event) resets the ack translation and sends the game's last inputs again with the first FULL view (plan §13.7). Bridge limits and fault reports (step 9, 2026-10-20, ADR-0006): `createBridgeGuard` rates game messages before decoding and caps pending requests; a game abusing the bridge is stopped, and every failure is reported to the backend through the Session port's `reportGameFault`. Used by Session Play. Fixed-aspect viewport (step 7, 2026-10-20): the GameVersion's logical viewport is a Host option passed to every container, with the fit math (`fitGameViewport`: whole, centered, one scale, bars) shared by every platform. Repository-wide implementation state: `CURRENT_STATE.md` at the root.

## Owns

The trusted side of the Game <-> Host boundary (plan §10, §11, §13.3-§13.6, §15, §16): the `GameHost` lifecycle (load artifact -> isolated container -> versioned bridge -> READY handshake -> projection/events/input flow -> resync/reload -> dispose), validation of every inbound bridge message, and the logic shared by `WebGameHost` (sandboxed iframe) and the future `NativeGameHost` (restricted WebView). Also the fixed-aspect logical viewport (§8): `GameViewport`, `fitGameViewport` and `viewportOrientation` (`src/viewport.ts`).

- `startGameHost(options)`: runs one artifact for one player. Options are ports: an `ArtifactLoader`, the GameVersion's `viewport` (its fixed logical size), a `GameContainer` (the platform's isolated container, which shows the game at that logical size scaled to fit its space), a `GameSessionPort` (the player's live connection plus its current view), the `GameContext`, and optionally an `AssetResolver`. Emits `status` (`loading` → `starting` → `running` | `failed` → `disposed`), `bridge-rejected` and `metric` (`artifact-load-ms`, `ready-ms`) events.
- `createArtifactLoader({ cache })`: fetches the signed URL without credentials, checks the SHA-256, caches by hash (`ArtifactCache` port; `createMemoryArtifactCache()` here, Cache Storage in the web app).
- `createAckTranslator()`: the game's sample ids <-> connection sample sequences.

The platform containers live in each app: the web one is `apps/web/src/platform/iframeGameContainer.ts`.

## Does not own

- The generated game's own render/state (the game is its own isolated application).
- Raw socket access: it talks to the session through the `GameSessionPort` (a `communication` `SessionConnection` fits it).
- Trusting the SDK: messages are validated even when they come from the official SDK.
- DOM or WebView APIs: those are the platform containers'.

## Depends on

- `@playhoot/protocol` (`/bridge`, `/bridge/validation`)
- `@playhoot/communication` (types, `Result`)
- `@playhoot/game-sdk` only in tests (the real SDK is wired to the Host in `gameHost.test.ts`)

Architecture rules: `ARCHITECTURE.md`. Plan section references (§N) point to `docs/Playhoot_Frontend_Architecture_Plan.docx`.
