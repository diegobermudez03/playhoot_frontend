# @playhoot/feature-notifications

Notifications feature (logical state and ports).

Status: IMPLEMENTED: `createNotifications` — the unread count and the plain entry list the shell's
panel shows, and marking one entry read; `createHistory` — the full history page with the
endpoint's filters; `createPreferences` — the optional email groups and the marketing choice,
whose switch records the acceptance or the withdrawal of the marketing text at its exact version.

## Owns

What the shell knows about a person's notifications: reading the list for whoever is signed in,
keeping the unread count, and marking one entry read when its content is opened or the person
marks it explicitly. Opening the panel marks nothing (P14§4). A type or source domain the backend
sends that this client does not know is still an entry; it is never dropped.

## Does not own

- Presentation and the text of each type (apps/web).
- Sending, channels and importance: the backend decides them.
- What a text says and what a published version is: Compliance's, read through its own client.
- Where an entry leads: its destination screen belongs to the milestone that builds it.

## External dependencies

- zustand (vanilla store only)

## Depends on

- `@playhoot/app-core`
- `@playhoot/communication`
- `@playhoot/protocol`

Architecture rules: `ARCHITECTURE.md`.
