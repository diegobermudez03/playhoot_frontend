# ADR-0008: Game assets declared by the game, delivered by the Host

Status: ACCEPTED
Created: 2026-10-25
Last status change: 2026-10-25
Supersedes: None
Superseded by: None

## Context

A game frontend runs isolated (ADR-0005, ADR-0006): no network, no storage, only the bridge. Until now a GameVersion's frontend was one self-contained HTML file, and the SDK's `requestAsset(key)` had no Host-side source (CHECKLIST I, Z4). Games need images (sprites included), audio and video without ever seeing where they are stored. The backend owns storage and signing; it keeps the decision in its own Session ADR (backend `play/docs/decisions/`). Game authoring and publishing do not exist yet in either repository.

## Decision

Decided by the human on 2026-10-25, from the agent's proposal and the human's own design:

**Declaration in the game.** A game declares every asset it uses once, at the top of its script, as an object literal from logical key to type: `const assets = playhoot.assets({ ship: 'image', thrust: 'audio' })`. Types are `image` (sprites and sprite sheets included), `audio` and `video`, nothing else. Keys are identifier-like (`^[A-Za-z][A-Za-z0-9_]{0,63}$`). The SDK loads only the handles of that declaration (`playhoot.load(assets.ship)`, `playhoot.preload([...])`), never a free string, so a static analysis can read the declaration and TypeScript refuses an undeclared asset. The game receives a local `blob:` URL created inside its frame, never a storage URL.

**Backend side (backend ADR).** Each GameVersion has its assets (key, type, MIME type, SHA-256, size, storage object) in a table. Closed MIME list (PNG, WebP, JPEG, SVG; MP3, OGG, WAV; MP4, WebM) and limits of 5 MB per image, 10 MB per audio, 50 MB per video, 100 MB per version. The HTML and every asset of a version are signed together as one batch with one expiry, stored in the database and shared by every Session of that version; a Session reuses the batch while it expires after the Session's own durable expiry, otherwise the backend signs a new batch (24 h). A URL handed to a client therefore always outlives its Session, so there is no refresh endpoint: a reconnection gets `session_started` with the current batch anyway.

**Delivery.** `session_started.frontend.assets` lists every asset with its key, type, MIME type, SHA-256, size and signed URL. No asset request goes through the WebSocket: the Host downloads from storage itself (without credentials), checks the size and the SHA-256, keeps verified bytes in the browser's Cache Storage by hash, and answers the game's bridge `request_asset` with the bytes, transferred to the frame (not copied). The Host serves only keys the backend listed; the SDK also refuses bytes whose MIME type does not match the type the game declared. The SDK paces its requests within the bridge limits (ADR-0006), so a game preloading many assets is never treated as abuse.

**Publishing rules (required for the future authoring flow, not built now).** At the transition to EXECUTABLE a static analysis of the frontend script confirms that every declared asset exists uploaded; uploaded assets the script does not declare are deleted from storage, keeping their row as a record; an EXECUTABLE version is immutable, assets included.

## Rationale

- The game never touches the network or a URL; the trusted Host does, so isolation (ADR-0006) is unchanged.
- One declaration makes the assets a game needs knowable before it runs (static analysis, publishing checks) and keeps typos out at compile time.
- URLs at start instead of on demand keep rendering traffic off the WebSocket and its limits, and need no round trip per asset.
- Shared, batch-signed URLs reduce external signing calls (in production each signature is a call to Google's IAM service) and let the browser's own HTTP cache serve a game played again.
- Signing past the Session's own expiry guarantees, by construction, that no URL expires mid-game; detecting an expired URL in a browser is unreliable (an expired signature answers 4xx, which a CORS-less error makes look like a network failure).
- Transferring bytes moves the buffer into the frame without a second copy; the Host reads a fresh buffer from Cache Storage for each answer.

## Alternatives Considered

### Asset URLs on demand over the WebSocket

Rejected: rendering traffic would compete with the game's own messages under the connection's rate limits; a game loading 100 assets at start would look like abuse.

### Any live URL plus a refresh endpoint for the Session's assets

Rejected by the agent and accepted by the human: the client would have to detect expiry (unreliable in browsers, and again in the mobile Host), and the endpoint would be one more surface to protect. Its only gain, shorter URL lifetimes, matters little for render assets every player receives anyway.

### Public URLs

Rejected: a public bucket, links that never expire, and no control over unpublished games.

### Host-created URLs passed to the frame

Rejected on the web: a `blob:` URL belongs to the origin that created it, and the game runs in an opaque origin.

## Consequences

- The bridge v1 wire is unchanged (`request_asset` / `asset` with bytes). The SDK's public API changes: `requestAsset(key)` is replaced by `assets()`, `load()` and `preload()`; only the fixtures used it.
- In a WebView the bytes need a text-safe form (CHECKLIST M); the game API (a URL) stays the same.
- The production bucket needs CORS for the web origin for assets too (BACKEND_CONTRACT G7).
- A leaked asset URL works for anyone until its batch expires (at most 24 h).
- Existing GameVersions have no assets; a new seed version of Space Drift carries some for end-to-end testing.

## Canonical Knowledge Impact

- `docs/architecture/BACKEND_CONTRACT.md`: `session_started.frontend.assets`, batch-signed URLs.
- `packages/game-sdk/README.md`, `packages/game-host/README.md`: the assets API and the Host's asset loading.
- `docs/logic/`: the asset download and its cache.
- ADR-0005: the asset request is now served.
- Backend repository: its Session ADR, `play/docs/FLOWS.md`, `play/docs/DATA_MODEL.md`, `api/README.md`.

## Implementation Impact

`@playhoot/protocol` (`frontend.assets` schema), `@playhoot/game-sdk` (declaration, loading, pacing), `@playhoot/game-host` (asset loader and cache, transfer through the container), `apps/web` (Cache Storage for assets, the iframe container's transfer), `session-join` / `session-play` (carry the list to the Host), the Space Drift fixture (a new seed version in the backend).
