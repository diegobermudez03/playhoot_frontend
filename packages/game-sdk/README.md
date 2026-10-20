# @playhoot/game-sdk

API exposed to the generated game frontend.

Status: SCAFFOLD, no behavior yet. Repository-wide implementation state: `CURRENT_STATE.md` at the root.

## Owns

The only Playhoot API a generated game sees (plan §9, §11, §15): `sample`, `command`, `onProjection`, `onEvent`, `onCommandResponse`, `requestAsset`, input/capability abstractions. It is bundled INTO the GameVersion frontend artifact and runs inside the sandboxed iframe/WebView. It talks to the Host only through the versioned bridge.

## Does not own

- Tokens, the real WebSocket, backend fetch, Host objects: never available to the game (§16).
- Any dependency on React, React DOM/Native or Host packages (lint-enforced): the same artifact must run on web and mobile.
- Security: the SDK is not a trust boundary; the Host validates everything.

## Depends on

- `@playhoot/protocol/bridge` only.

Architecture rules: `ARCHITECTURE.md`. Plan section references (§N) point to `docs/Playhoot_Frontend_Architecture_Plan.docx`.
