# @playhoot/game-react

The React surface of a game's client, on top of `@playhoot/game-sdk`: `mountGame` (called by the build with the assets `game.project.json` declares), `useView`, `usePlayer`, `useCommand` (validates the payload against its declaration first: `invalid_payload` is never sent), `useInputs` (one shared snapshot, validated, sent whole), `useAsset` (`loading` / `ready` / `missing` / `error`), `useGameEvent`, `useGameError` and `usePhase` (the `PhaseView` a game with phases gets in every view); `ranking` re-exported for the client.

UI (SDK delivery 1): `Screen` (theme, legible type and comfortable targets from the presentation context, padding for the safe area), `Stack`, `Grid`, `Panel`, `Text` and `u()`; semantic controls built on React Aria (press, focus, keyboard navigation): `Button` (activate), `Choices` (select), `TextAnswer` (text); `Countdown`, `Scoreboard`, `AssetImage`; `usePresentation()` (bridge v2).

Bundled into the game's frontend artifact, which runs inside the untrusted game frame: it owns its renderer (`react-dom`) and reaches the Host only through the Game SDK.
