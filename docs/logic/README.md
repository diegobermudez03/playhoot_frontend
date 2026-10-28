# Logic Mirror

Status: CANONICAL HUMAN-FACING MIRROR — kept in sync with the code by every change that alters it

This folder explains what the frontend DOES, without UI: which external calls it makes, what it does with the answers, what state it keeps (global and per feature), and when it navigates. It is written for a reader who does not read this repository's TypeScript.

| File | What it gives you |
| --- | --- |
| [FLOWS.md](FLOWS.md) | Every user-visible flow step by step, with sequence diagrams: bootstrap, home, joining, lobby, start, reconnection, leaving, endings, preferences, signing in. |
| [mirror/](mirror/) | The same logic as Go-syntax pseudocode, traceable from a URL: routes → screens → events → state → external calls. |

## How to read the mirror

It is pseudocode with Go syntax: it does not compile and never runs, it only mirrors the code. Follow it like a call trace:

1. **[mirror/routes.go](mirror/routes.go)** — start here. Every URL and the view it runs. Navigating anywhere is just a call to `Router(url)`, so you can keep following.
2. **`view_*.go`** — one per screen. The view function only lists what can happen on that screen; each call has a comment saying WHEN (a click, a submit, a message from the server). The Session route (`view_session.go`) picks one of its screens (`view_session_connecting.go`, `_lobby`, `_started`, `_outcome`) by the feature's phase.
3. **Event functions** (`EnterCodeOnJoinPressed`, `GuestSignInOnSubmitted`, `LobbyOnLeave`…) — right below each view. They call the logic, and `Navigate(...)` when the screen changes.
4. **`state_*.go`** — what the events do to state: `state_app.go` (global state and browser storage), `state_joinsession.go` (the Session route's feature: phases, transitions, rules), `state_connection.go` (one live WebSocket), `state_sessionplay.go` (the started game's feature), `state_gamehost.go` (a game running in its sandboxed iframe).
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
| Every page (top bar), nobody signed in | Person icon (**Iniciar sesión** / Sign in / Entrar on wide screens) | `Navigate(SignInURL(here))` | [view_app_shell.go](mirror/view_app_shell.go) |
| Every page (top bar), guest | Initial → **Iniciar sesión** / Sign in / Entrar | `Navigate(SignInURL(here))` | [view_app_shell.go](mirror/view_app_shell.go) |
| Every page (top bar), account | Initial → **Cerrar sesión** / Sign out / Sair | `AppShellOnSignedOut` | [view_app_shell.go](mirror/view_app_shell.go) |
| Enter a code (`/join`) | **Crear una partida** / Host a game / Criar uma partida | `Navigate("/sessions/new")` (sign in first without an account) | [view_enter_code.go](mirror/view_enter_code.go) |
| Host screen: lobby | **Iniciar partida** / Start game / Começar partida | `host.StartGame()` | [view_host.go](mirror/view_host.go) |
| Host screen: lobby | **Unirme a jugar** / Join the game / Entrar no jogo (the creator's own row, and the "¿Juegas tú?" hint) | `host.PlayToo()` | [view_host.go](mirror/view_host.go) |
| Host screen: lobby, starting without playing | **Iniciar sin mí** / Start without me / Começar sem mim · **Unirme y empezar** / Join and start / Entrar e começar | `host.StartGame()` · `host.JoinAndStart()` | [view_host.go](mirror/view_host.go) |
| Host screen (any phase) | **Cancelar partida** → **Sí, cancelar** / Cancel game → Yes, cancel | `host.Cancel()` | [view_host.go](mirror/view_host.go) |
| Host screen: game | A participant's button ("Viendo a" / Watching / Vendo) | `host.Watch(participantID)` | [view_host.go](mirror/view_host.go) |
| Host screen: outcome | **Intentar de nuevo** / **Volver al inicio** | `host.Retry()` / `Navigate("/join")` | [view_host.go](mirror/view_host.go) |
| Guest page (`/sign-in/guest`) | Tu nombre / Your name / Seu nome (field) | `GuestSignInState.Name` | [view_sign_in_guest.go](mirror/view_sign_in_guest.go) |
| Guest page (`/sign-in/guest`) | **¡A jugar!** / Let's play / Bora jogar | `GuestSignInOnSubmitted` | [view_sign_in_guest.go](mirror/view_sign_in_guest.go) |
| Guest page (`/sign-in/guest`) | **Inicia sesión o regístrate** / Sign in or sign up / Entre ou cadastre-se | `Navigate(SignInURL(next))` | [view_sign_in_guest.go](mirror/view_sign_in_guest.go) |
| Sign-in page (`/sign-in`) | Continuar con Google / Continue with Google (disabled for now) | — | [view_sign_in.go](mirror/view_sign_in.go) |
| Sign-in page (dev only) | Test user 1 / Test user 2 | `SignInOnDevAccountPicked` | [view_sign_in.go](mirror/view_sign_in.go) |
| Session: lobby | **Copiar enlace de invitación** / Copy invite link / Copiar link de convite | `LobbyOnCopyInvite` | [view_session_lobby.go](mirror/view_session_lobby.go) |
| Session: lobby | **Salir de la partida** / Leave game / Sair da partida | `LobbyOnLeave` | [view_session_lobby.go](mirror/view_session_lobby.go) |
| Session: game | **Jugador 2 de 3** / Player 2 of 3 / Jogador 2 de 3 | opens the players list (no call) | [view_session_started.go](mirror/view_session_started.go) |
| Session: game | **Salir** / Leave / Sair | `join.Leave()` | [view_session_started.go](mirror/view_session_started.go) |
| Session: game, failed to load | **Intentar de nuevo** / Try again / Tentar de novo | `play.Reload()` | [view_session_started.go](mirror/view_session_started.go) |
| Session: game, failed to load | **Salir de la partida** / Leave game / Sair da partida | `join.Leave()` | [view_session_started.go](mirror/view_session_started.go) |
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
