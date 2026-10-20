# @playhoot/game-sdk

API exposed to the generated game frontend.

Status: MINIMAL SDK (plan step 5, bridge v1, ADR-0005 PROPOSED). Repository-wide implementation state: `CURRENT_STATE.md` at the root.

## Owns

The only Playhoot API a generated game sees (plan §9, §11, §15). It is bundled INTO the GameVersion frontend artifact and runs inside the sandboxed iframe/WebView. It talks to the Host only through the versioned bridge.

```ts
import { createPlayhoot } from '@playhoot/game-sdk';

const playhoot = createPlayhoot();
playhoot.onProjection(({ state, full, ack }) => render(state)); // whole state; full = new baseline
playhoot.onEvent((event) => showEvent(event));                   // each delivered once
playhoot.onError((error) => showError(error));
const { participantId, participants, locale } = await playhoot.ready();

playhoot.sample({ move: [1, 0], boost: false });                 // full input snapshot; returns its id
const { outcome, response } = await playhoot.command('teleport', { x: 500, y: 500 });
const url = await playhoot.requestAsset('ship');                 // a blob: URL, or rejects
```

- `outcome` is `executed` (with the game script's `response`), `rejected` or `unavailable`.
- `ack` is the game's own last sample id the backend consumed, for prediction/reconciliation.
- Transport: `postMessage` to the parent window by default (`windowParentTransport`); a WebView host will provide its own `BridgeTransport`.

## Does not own

- Tokens, the real WebSocket, backend fetch, Host objects: never available to the game (§16).
- Any dependency on React, React DOM/Native, Host packages or the Host's validation code (lint-enforced): the same artifact must run on web and mobile, and stay small.
- Security: the SDK is not a trust boundary; the Host validates everything.

## Depends on

- `@playhoot/protocol/bridge` only (types and constants, no runtime dependencies).

Architecture rules: `ARCHITECTURE.md`. Plan section references (§N) point to `docs/Playhoot_Frontend_Architecture_Plan.docx`.
