# @playhoot/feature-account

Account feature (logical state and ports).

Status: IMPLEMENTED: `createMyData` (the composed read of the caller's own data, the display-name
change with V-10's allowance, the interface language and the mode switch), `createSignInMethods`
(the ways into an account: listing, adding an address with a code, removing one) and
`createDeletion` (ending one's own identity).

## Owns

The person's own corner as screen-independent state: what `GET /v1/me` answered, which of the
three settings is being written down and how each one was refused, the email round trip that adds
an address, and the deletion that ends the identity and forgets the credential.

## Does not own

- Presentation (apps/web), including every word shown and the list of places.
- The provider round trip: it leaves the page, so it belongs to `@playhoot/feature-sign-in`.
- Whether an operation is allowed: the backend decides on every request.
- Where to go afterwards (the route decides).

## External dependencies

- zustand (vanilla store only)

## Depends on

- `@playhoot/app-core`
- `@playhoot/communication`
- `@playhoot/protocol`

Architecture rules: `ARCHITECTURE.md`.
