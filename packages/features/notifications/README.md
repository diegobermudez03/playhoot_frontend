# @playhoot/feature-notifications

Notifications feature (logical state and ports).

Status: IMPLEMENTED: `createNotifications` — the unread count and the plain entry list the shell's
panel shows, and marking one entry read.

## Owns

What the shell knows about a person's notifications: reading the list for whoever is signed in,
keeping the unread count, and marking one entry read when its content is opened or the person
marks it explicitly. Opening the panel marks nothing (P14§4). A type or source domain the backend
sends that this client does not know is still an entry; it is never dropped.

## Does not own

- Presentation and the text of each type (apps/web).
- Sending, channels, importance and preferences: the backend decides them.
- Where an entry leads: its destination screen belongs to the milestone that builds it.

## External dependencies

- zustand (vanilla store only)

## Depends on

- `@playhoot/app-core`
- `@playhoot/communication`
- `@playhoot/protocol`

Architecture rules: `ARCHITECTURE.md`.
