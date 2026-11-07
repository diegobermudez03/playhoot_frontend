# @playhoot/game-tools

Builds an authoring project into a game version:

```
node --experimental-strip-types packages/game-tools/src/cli.ts build <project> [--out <dir>] [--json]
```

A project is `game.project.json` (`format`, `aspectRatio`, optional `assets`; the game's name lives in its Game Management card, never here) plus `shared/` (optional), `server/game.ts` (default export: `defineGame(...)`) and `client/Game.tsx` (default export: the React component). See `fixtures/sdk-games/tap-race`.

Steps, stopping at the first that fails with diagnostics (stage, file, line):

1. project layout;
2. per-file source rules (`check.ts`): what each area may import, and for server and shared code the `sdk-v1` rules (top level only functions, types and constants of literals, functions or SDK definition calls; no escapes from the sandbox);
3. type check, strict but without checked index access or exact optional properties;
4. bundles (rolldown): `server.js`, one flat classic script with generated entrypoints and `__playhoot_module_values()`, and `client.html`, one self-contained page;
5. a smoke run of `start` and `project` with the minimum players.

`game.project.json`'s `"assets"` (checked with the backend's rules) becomes the module `@playhoot/assets` the client imports: one handle per key, generated for the bundle and, in memory, for the type check, so an undeclared key is a type error.

`game.project.json`'s `"config"` and `config.json` (`src/config.ts`, 2026-11-07) are checked together (declaration problems on `game.project.json`, value problems on `config.json`, each with the value's path) and become two generated modules, typed from the declaration: `@playhoot/config` (private values left out; shared, server and client may import it) and `@playhoot/config/server` (every value; server only). Rules for agents: `apps/web/public/docs/sdk/v1/config.md`.

Outputs `server.js`, `client.html`, `manifest.json` (derived from the definition) and `build.json` (profile, aspect ratio, hashes). The backend's scriptcheck profile `sdk-v1` checks `server.js` again and decides.

SDK packages always resolve from the toolchain, wherever the project lives.
