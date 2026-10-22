# ADR-0005: Game <-> Host bridge protocol v1 and artifact loading

Status: ACCEPTED
Created: 2026-10-20
Last status change: 2026-10-20 (amended 2026-10-21: run-time transport selection)
Supersedes: None
Superseded by: None

## Context

Plan steps 4 and 5 (WebGameHost and Game SDK, §10, §11, §13.3, §16) need a concrete bridge between the untrusted game artifact and the trusted Host. The plan fixes the responsibilities and leaves the message catalog and names open (§11, §19 "final Game SDK schema and names"). The backend left the bridge out of its scope (BACKEND_CONTRACT G9), so this repository defines it. The backend gives the player a signed artifact URL (15 min TTL, resent unchanged on reattach, G5) and the artifact's SHA-256; today the artifact is one self-contained HTML file with no assets or frontend metadata (G6).

The human chose on 2026-10-20 to build steps 4 and 5 together against a local fixture game, and to load artifacts by fetching them, verifying the hash and caching by hash.

## Decision

**Transport.** On the web, `postMessage` between the Host page and a sandboxed iframe (`sandbox="allow-scripts"`, opaque origin). Every message is a plain object `{ bridge: "playhoot.bridge", type, ... }`; anything without the marker is ignored. The Host accepts messages only from the iframe it created. A WebView host will carry the same objects over its own messaging. Amended 2026-10-21 (approved by the human, CHECKLIST M): the SDK chooses its transport at run time so one artifact runs on every Host: in a React Native WebView (`window.ReactNativeWebView` present) it posts each message as JSON text through that channel and reads JSON text from `message` events on `window` or `document`; otherwise it uses the parent window. The message catalog is unchanged; every message except `asset` (which carries an `ArrayBuffer`) is JSON-safe, and how asset bytes cross a text-only channel is decided with asset delivery (CHECKLIST Z4).

**Versioning.** The game's `ready` lists the bridge versions its SDK speaks; the Host answers with the newest common one in `start`, or `incompatible` and stops. A released version never changes; changes are new versions, so old GameVersion artifacts stay interpretable.

**Catalog v1.**

| Direction | Type | Content |
| --- | --- | --- |
| Game → Host | `ready` | `versions` |
| Game → Host | `sample` | `id` (the game's own sample number, growing), `inputs` (full logical input snapshot) |
| Game → Host | `command` | `id` (correlation), `name`, `payload` |
| Game → Host | `request_asset` | `id`, `key` (logical asset key) |
| Host → Game | `start` | `version`, `context` (`participantId`, `participants`, `locale`), `projection` or null |
| Host → Game | `update` | `projection?` (`state`, `full`, `ack`), `ack`, `events`, `errors` |
| Host → Game | `command_result` | `id`, `outcome` (`executed` / `rejected` / `unavailable`), `response?` |
| Host → Game | `asset` | `id`, `key`, `found`, and when found `mimeType` + `bytes` |
| Host → Game | `incompatible` | `supported` |

The Host owns every protocol mechanic (§13.4-§13.6, §15): it applies view patches and sends the game the whole current projection; it maps the game's sample ids to connection sample sequences and translates the backend's ack back into the game's numbering; it creates and hides command idempotency tokens. The game never sees tokens, the WebSocket, connection sequences, revisions, signed URLs or asset locations.

**Validation.** The Host validates every game message (zod, `@playhoot/protocol/bridge/validation`): exact shape (unknown fields refused), size ≤ 32 KiB, sample ids strictly growing, nothing but `ready` before the game has started, one `ready` only. A refused message is recorded (`bridge-rejected`) and dropped; it does not stop the game. The SDK imports only dependency-free types and constants (`@playhoot/protocol/bridge`), so validation code is never bundled into game artifacts (lint-enforced).

**Artifact loading.** The Host fetches the signed URL without credentials, checks the SHA-256 of the bytes, and caches the verified HTML by hash (the web uses Cache Storage, falling back to memory). Later loads (reconnect, refresh) use the cache, so the 15-minute URL lifetime does not matter once the game has loaded once on that browser. The HTML goes into the iframe's `srcdoc` after the Host parses it with `DOMParser` and inserts a Content-Security-Policy `<meta>` as the first element of its head: no network (`connect-src 'none'`, no external images/media/fonts), only inline/blob scripts and styles, `blob:`/`data:` media, no `base`, no forms. A second `load` of the iframe (the game navigating its frame) is a container violation: the Host disposes the container.

**Failures** are typed GameHost errors: `artifact-unreachable`, `artifact-hash-mismatch`, `ready-timeout` (10 s), `unsupported-bridge-version`, `container-violation`.

## Rationale

- One `update` per backend view keeps ordering (projection, then its events) and halves message count compared with separate projection/event messages at 60 Hz.
- Sending the whole projection instead of patches keeps every game simple and keeps patch semantics in one place (`communication`); the bridge is in-process, so size is not a concern at today's projection sizes.
- Game-owned sample ids make prediction/reconciliation independent of reconnections, which restart connection sequences at 1.
- Three command outcomes are what a game can act on; the Host keeps the detailed backend outcome for itself.
- Fetch + hash + cache verifies the bytes the backend pinned and survives G5 without a backend change. In development fake-gcs answers `Access-Control-Allow-Origin: *` (checked 2026-10-20).
- `DOMParser` places the policy exactly where the browser's own parser would see it first, which string insertion into untrusted HTML cannot guarantee.

## Alternatives Considered

### iframe `src` pointing at the signed URL

Simplest and avoids CORS, but loses the hash check, cannot add a CSP, gives the game the storage origin, and fails after 15 minutes on reconnect. Not chosen by the human.

### `MessageChannel` ports instead of window `postMessage`

Removes the per-message source check but has no equivalent in a WebView bridge; the window channel plus source check is enough and keeps one shape for both hosts.

### Forwarding patches to the game

Smaller messages but every game would reimplement patch merging, which the plan assigns to the Host.

## Consequences

- Production needs CORS on the artifact bucket for the web origin (BACKEND_CONTRACT G7, CHECKLIST Z7).
- Asset delivery exists in the bridge but no asset has a source until the backend stores them (Z4); `requestAsset` answers `found: false` outside development.
- The Host cannot yet validate SAMPLE/COMMAND against the GameVersion's declared inputs and commands: the client does not receive the manifest (Z6). The backend still validates.
- A game navigating its own frame can leak data in the URL before it is disposed (CSP cannot block frame navigation); the data available to it is only the player's own projection. Hardening (§16, plan step 9) revisits this, with rate limits on game messages. (2026-10-20: closed by ADR-0006, which also adds the bridge limits.)
- Reconnection (new connection, sequences from 1) needs the ack translator reset with the connection; that is Session Play's job (step 6).

## Canonical Knowledge Impact

- `ARCHITECTURE.md` "Game Frontend And GameHost" records the bridge and loading rules.
- `packages/protocol/README.md` points to this ADR as the owner of the catalog.

## Implementation Impact

Accepted by the human on 2026-10-20 (every name approved). Implemented 2026-10-20: `@playhoot/protocol/bridge` (+ `/validation`), `@playhoot/game-host` (`startGameHost`, `createArtifactLoader`), `@playhoot/game-sdk` (`createPlayhoot`), the web iframe container and artifact cache (`apps/web/src/platform`), the Space Drift fixture (`fixtures/games/space-drift`) and the development lab `/dev/game-host`.
