# @playhoot/feature-game-authoring

Game Authoring feature (logical state and ports): the workspace where a creator, alone or with an AI, changes the draft of a game.

Status: IMPLEMENTED (game-creation-web-v1 CHECKLIST B): `createGameAuthoring` (read the current revision with its files, apply a change, edit one file, restore a revision, upload and remove assets, follow the current revision's build with the backend's long poll, the revisions list) and `parsePastedChange` (a pasted envelope read strictly as data, with its summary). Repository-wide implementation state: `CURRENT_STATE.md` at the root.

## Owns

- The draft as the backend reports it, and the outcome of the last action as kinds and values.
- One idempotency key per action: retrying the same action sends the same key; another action takes a new one.
- Reading pasted text as the change envelope (`playhoot.project-change.v1`, or that JSON in one code fence) and its added / modified / deleted summary. Never guessing code inside free text, never repairing truncated JSON.

## Does not own

- Presentation and text (apps/web).
- Deciding whether a change is valid, or what a build found (the backend decides).
- Surviving route exit: state is discarded and rebuilt from URL + backend.

## External dependencies

- zustand (vanilla store only)

## Depends on

- `@playhoot/communication`
- `@playhoot/protocol`

Architecture rules: `ARCHITECTURE.md`.
