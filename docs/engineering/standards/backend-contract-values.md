# Backend Contract Values Standard

Status: CANONICAL ENGINEERING STANDARD

Accepted by the human on 2026-10-25.

The frontend consumes the backend's contract; it never owns it. The backend may add values at any time: reasons, statuses, causes, outcomes, kinds, message types.

## Rules

1. Never assume a list of backend values is complete. Known values get their specific handling; every other value goes to a general default.
2. Decide what the value means for the action, not which value it is. When an unknown value can break the action (for example an unknown rejection reason), the action is handled as declined or failed, with a general message. When it cannot (for example an unknown end cause), a sensible default applies.
3. Wire schemas accept any value where the backend's list may grow (a string, not a closed enum). An unknown value is never a protocol error; only a message that breaks its shape is. Closed enums are for fields that select the shape (a message's `type`).
4. An unknown value is normal contract evolution, not corrupt data: it needs no alert. Telemetry may count it like any other outcome.
5. Lists of known values live in `@playhoot/protocol`, next to the schema that carries them, so adding one is one change.

## Examples in the code

- Join rejections: known reasons have their own message; any other shows the unexpected error (`apps/web/src/features/session-join/outcomeCopy.ts`).
- Session endings: known statuses and causes pick the message; any other shows "the game has ended".
- Command outcomes: unknown outcomes arrive as `unknown` (`packages/communication/src/sessionConnection.ts`) and reach the game as `unavailable`.
- Roster presence: an unknown status shows as "Unknown".
