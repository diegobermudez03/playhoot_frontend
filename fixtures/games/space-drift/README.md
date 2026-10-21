# Space Drift (fixture game)

The frontend of the backend's seed game Space Drift (`../playhoot/play/session/internal/migrations/seed_20261018000000_space_drift.go`), built with `@playhoot/game-sdk`. A small real game for end-to-end work on the GameHost and the SDK (plan step 5), not a product.

- Renders the PlayerProjection (`arena`, `me`, `others`, `star`, `simulatedThrough`) on a canvas, easing positions between updates.
- Inputs as SAMPLEs: `move` (vector2) from WASD/arrows or a drag-to-steer virtual stick, `boost` (boolean) from Shift/Space or a second finger.
- COMMAND `teleport` `{x, y}` on double click/tap; a failed or cooldown answer shakes the ship.
- Events `SHIP_ADRIFT` / `SHIP_RECLAIMED` flash a ring around the ship.
- Asks the Host for the asset `ship`; without it ships are drawn as triangles.
- No text, so no translations.

## Build

`npm run fixtures` (root) or `npm run build -w @playhoot/fixture-space-drift` writes `dist/index.html`, ONE self-contained HTML file (the only artifact shape the backend stores today, BACKEND_CONTRACT G6), and `dist/artifact.json` with its SHA-256.

## Use

- Development lab: `npm run dev`, then http://localhost:5173/dev/game-host runs it in the real WebGameHost against a fake local Session.
- Against the real backend: the backend embeds this artifact as Space Drift's frontend package in its seed version `33333333-3333-4333-8333-0000000000c2` (`../playhoot/play/session/internal/migrations/seeddata/`, added 2026-10-20 at the human's direction). After changing the game, rebuild it, copy `dist/index.html` there and add a NEW seed version in the backend (its README says how): a GameVersion's frontend never changes in place.
