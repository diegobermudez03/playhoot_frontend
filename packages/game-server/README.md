# @playhoot/game-server

A game's authoritative logic: `defineGame` (setup, command handlers, inputs, update, leave, rejoin, view) and `reject`.

- `.` is what game code imports.
- `./runtime` is the adapter to the backend sandbox ABI (`play/runtime/sandbox` in `../playhoot`). The build tools generate the script's global entrypoints (`start`, `command`, `samples`, `update`, `playerDisconnected`, `playerRejoined`, `project`) calling it with the game's definition, and `__playhoot_manifest()`, from which the runtime manifest is derived. Game code never imports it.

Handlers receive the state as fresh JSON on every call and change it in place; the backend profile `sdk-v1` allows that and forbids state kept outside it (top-level constants are frozen when the script loads). Bundled into the backend script only; depends only on `@playhoot/game-core`.
