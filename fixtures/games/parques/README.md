# Parqués (fixture game)

The frontend of the backend's seed game Parqués (`../playhoot/play/session/internal/migrations/seed_20261020100000_parques.go`, whose opening comment has the rules), built with `@playhoot/game-sdk`. A turn-based fixture played only through COMMANDs, for end-to-end work on the GameHost and the SDK, not a product.

- Renders the PlayerProjection (`board`, `players`, `turn`, `lastRoll`, `winner`, `moves`) on a canvas, rotated so the player's own side is at the bottom; pieces glide between updates.
- No SAMPLEs. COMMAND `roll` from the button (or Space/Enter); COMMAND `move` `{piece, die: a|b|sum}` by tapping a highlighted piece: with one possible move it is sent at once, otherwise the die buttons or the highlighted target squares choose. A refused command shows its reason.
- A turn bar counts the 30 seconds down from when the turn (or its deadline) changed.
- Narrates the events (`ROLLED`, `CAPTURED`, `RELEASED`, `CROWNED`, `GOAL`, `TURN_TIMEOUT`, `PLAYER_LEFT`, `PLAYER_BACK`, `WINNER`) in a short log.
- Text in Spanish, English or Portuguese, from the platform locale. Players are named by their colour (the projection carries ParticipantIDs only).
- No assets.

## Build

`npm run fixtures` (root) or `npm run build -w @playhoot/fixture-parques` writes `dist/index.html`, ONE self-contained HTML file (BACKEND_CONTRACT G6), and `dist/artifact.json` with its SHA-256.

## Use

Against the real backend: the backend embeds this artifact as Parqués' frontend package in its seed version `44444444-4444-4444-8444-0000000000d1` (`../playhoot/play/session/internal/migrations/seeddata/parques_frontend.html`). Create a Session with `node scripts/dev-host.mjs --game 44444444-4444-4444-8444-444444444444` and join it from two browsers (two to four players). After changing the game, rebuild it, copy `dist/index.html` there and add a NEW seed version in the backend: a GameVersion's frontend never changes in place.
