# Project

## Files

| Path | Required | What it holds |
|---|---|---|
| `game.project.json` | yes | Project settings: format, languages, aspect ratio, assets. |
| `server/game.ts` | yes | Default export: `defineGame({...})`. Other `server/*.ts` files may hold helpers. |
| `client/Game.tsx` | yes | Default export: the React component of one player's screen. Other `client/*.tsx`/`*.ts` files may hold components. |
| `shared/*.ts` | no | Declarations both sides import: commands, inputs, the view's type. |
| `scenarios/*.json` | no | Scenarios kept with the project (`scenarios.md`). Never built. |
| `notes.md` | no | Purpose, agreed rules, open decisions, known problems. |

**Required:** no other paths are accepted.

## game.project.json

```json
{
  "format": "playhoot.project.v1",
  "languages": ["es", "en"],
  "aspectRatio": "16:9",
  "assets": {
    "cardBack": { "type": "image", "description": "Back of a card, 512x768, dark blue" },
    "flip": { "type": "audio", "description": "Short card flip sound", "optional": true }
  }
}
```

- `format`: always `playhoot.project.v1`.
- `languages`: required. The languages the game is written in, its main one first: one or more of `es`, `en`, `pt-BR` (Playhoot's languages), without repeats. Each player sees the game in their Playhoot language when it is listed, otherwise in the main one; the SDK's own texts follow (`client.md`, "Languages and texts"). **Recommended:** one language is enough; list more only when every text the game shows exists in each of them.
- `aspectRatio`: `16:9` (default), `9:16`, `4:3`, `3:4` or `1:1`. The client is drawn at a fixed logical size for it (`client.md`).
- `assets`: optional, see `assets.md`.
- The game's name is not here: it lives in the game's card, which the owner edits in Playhoot.

## Imports

| Area | May import |
|---|---|
| `shared/` | `@playhoot/game-core`, other `shared/` files |
| `server/` | `@playhoot/game-core`, `@playhoot/game-server`, `shared/`, `server/` files |
| `client/` | `@playhoot/game-core`, `@playhoot/game-react`, `@playhoot/assets`, `@playhoot/project`, `react`, `shared/`, `client/` files |

**Required:** the client can never import server code: it would reach players. Anything both need goes in `shared/`. Imports must name what they take (no side-effect imports). Relative imports omit the extension (`'../shared/actions'`).

## Path rules and limits (required)

- Relative paths with forward slashes, at most 200 characters; segments of letters, digits, `_`, `-`, `.`; never `.` or `..`.
- `.ts`/`.tsx` under `shared/`, `server/`, `client/`; `.json` under `scenarios/`.
- At most 100 files, 256 KiB per file, 2 MiB in all. Text must be UTF-8.
- `game.project.json`, `server/game.ts` and `client/Game.tsx` cannot be deleted.
