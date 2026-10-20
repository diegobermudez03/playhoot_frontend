# @playhoot/game-host

GameHost abstraction and shared bridge logic.

Status: SCAFFOLD, no behavior yet. Repository-wide implementation state: `CURRENT_STATE.md` at the root.

## Owns

The trusted side of the Game <-> Host boundary (plan §10, §11, §13.3-§13.6, §15, §16): the `GameHost` lifecycle (load artifact -> isolated container -> versioned bridge -> READY handshake -> projection/events/input flow -> resync/reload -> dispose), validation of every inbound bridge message against the GameVersion contract, and the logic shared by `WebGameHost` (sandboxed iframe) and the future `NativeGameHost` (restricted WebView). Also the fixed-aspect logical viewport math and coordinate normalization (§8).

## Does not own

- The generated game's own render/state (the game is its own isolated application).
- Raw socket access: it talks to the session through `communication`.
- Trusting the SDK: messages are validated even when they come from the official SDK.

## Depends on

- `@playhoot/protocol`
- `@playhoot/communication`
- `@playhoot/device`

Architecture rules: `ARCHITECTURE.md`. Plan section references (§N) point to `docs/Playhoot_Frontend_Architecture_Plan.docx`.
