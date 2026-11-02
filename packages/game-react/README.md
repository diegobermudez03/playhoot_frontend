# @playhoot/game-react

The React surface of a game's client: `mountGame` (called by the build), `useView`, `useCommand` and `usePlayer`, on top of `@playhoot/game-sdk`.

Bundled into the game's frontend artifact, which runs inside the untrusted game frame: it owns its renderer (`react-dom`) and reaches the Host only through the Game SDK.
