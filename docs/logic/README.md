# Logic Mirror

Status: CANONICAL HUMAN-FACING MIRROR — kept in sync with the code by every change that alters it

This folder explains what the frontend DOES, without UI: which external calls it makes, what it does with the answers, what state it keeps (global and per feature), and when it navigates. It is written for a reader who does not read this repository's TypeScript.

| File | What it gives you |
| --- | --- |
| [FLOWS.md](FLOWS.md) | Every user-visible flow step by step, with sequence diagrams: bootstrap, home, identity, joining, lobby, start, reconnection, leaving, endings, preferences. |
| [mirror/](mirror/) | The same logic as Go-syntax pseudocode, traceable from a URL: routes → screens → events → state → external calls. |

## How to read the mirror

It is pseudocode with Go syntax: it does not compile and never runs, it only mirrors the code. Follow it like a call trace:

1. **[mirror/routes.go](mirror/routes.go)** — start here. Every URL and the view it runs. Navigating anywhere is just a call to `Router(url)`, so you can keep following.
2. **`view_*.go`** — one per screen. The view function only lists what can happen on that screen; each call has a comment saying WHEN (a click, a submit, a message from the server). The Session route (`view_session.go`) picks one of its screens (`view_session_identity.go`, `_connecting`, `_lobby`, `_started`, `_outcome`) by the feature's phase.
3. **Event functions** (`EnterCodeOnJoinPressed`, `IdentityOnSubmitted`, `LobbyOnLeave`…) — right below each view. They call the logic, and `Navigate(...)` when the screen changes.
4. **`state_*.go`** — what the events do to state: `state_app.go` (global state and browser storage), `state_joinsession.go` (the Session route's feature: phases, transitions, rules), `state_connection.go` (one live WebSocket).
5. **[mirror/external.go](mirror/external.go)** — every backend call as a bare function: endpoint in the comment, inputs in, DTO out.

## Where is each button?

Every control a person can use, by the text they see (es / en / pt), and the event function it runs:

| Screen (URL) | Control | Event function | File |
| --- | --- | --- | --- |
| Every page (top bar) | Logo | `Navigate("/")` (redirects to `/join` for now) | [view_app_shell.go](mirror/view_app_shell.go) |
| Every page (top bar) | Language picker | `AppShellOnLanguagePicked` | [view_app_shell.go](mirror/view_app_shell.go) |
| Every page (top bar) | Speaker button | `AppShellOnSoundToggled` | [view_app_shell.go](mirror/view_app_shell.go) |
| Enter a code (`/join`) | Code tiles | `EnterCodeOnCodeTyped` | [view_enter_code.go](mirror/view_enter_code.go) |
| Enter a code (`/join`) | **Unirme** / Join / Entrar | `EnterCodeOnJoinPressed` | [view_enter_code.go](mirror/view_enter_code.go) |
| Session: name step | Tu nombre / Your name / Seu nome (field) | `IdentityScreenState.Name` | [view_session_identity.go](mirror/view_session_identity.go) |
| Session: name step | **¡A jugar!** / Let's play / Bora jogar | `IdentityOnSubmitted` | [view_session_identity.go](mirror/view_session_identity.go) |
| Session: name step (dev only) | Test user 1 / Test user 2 | `IdentityOnDevAccountPicked` | [view_session_identity.go](mirror/view_session_identity.go) |
| Session: lobby | **Copiar enlace de invitación** / Copy invite link / Copiar link de convite | `LobbyOnCopyInvite` | [view_session_lobby.go](mirror/view_session_lobby.go) |
| Session: lobby | **Salir de la partida** / Leave game / Sair da partida | `LobbyOnLeave` | [view_session_lobby.go](mirror/view_session_lobby.go) |
| Session: ending | **Intentar de nuevo** / Try again · **Jugar aquí** / Play here | `OutcomeOnRetry` | [view_session_outcome.go](mirror/view_session_outcome.go) |
| Session: ending | **Ingresar un código** / Enter a code / Digitar um código | `OutcomeOnEnterAnotherCode` | [view_session_outcome.go](mirror/view_session_outcome.go) |
| Not found / error | **Ir al inicio** / Go home / Ir para o início | `Navigate("/")` (redirects to `/join` for now) | [view_not_found.go](mirror/view_not_found.go) |

Conventions:

- Event comments name controls by their visible text in Spanish / English / Portuguese.

- Computation and rules are comments (`// rule: ...`, `// computes: ...`), not code.
- `// -> X` says where control goes next (another screen, a state method, a call).
- `// code: path#symbol` names the real code each piece mirrors.

Not mirrored: presentation (components, layout, animations, sounds, translations), which has no effect on state, calls or navigation.

## Keeping it true (agents)

Any change that alters an external call, a state shape, a transition, a screen's events, or navigation updates this folder in the same change: the affected `view_*.go` / `state_*.go` / `external.go` / `routes.go` and, when a flow changes, `FLOWS.md`. A new screen gets its own `view_*.go`, reachable from `routes.go` or from its parent view; every new control gets a row in "Where is each button?" and its visible text in the event comment. A mirror that disagrees with the code is a bug; report it as drift and fix the mirror to match the code (the code is the authority).
