# Playhoot Design System

Status: ACCEPTED DIRECTION (the human approved the agent's proposal on 2026-10-20 and asked for it to stay token-driven, lively and with sound). Details keep evolving with the human's feedback.

Living style guide: run `npm run dev` and open `http://localhost:5173/design` (development only). It shows the tokens, the components and every Join Session screen with fake state.

Code: tokens in `apps/web/src/ui/tokens.css`, motion in `apps/web/src/ui/motion.css`, components in `apps/web/src/ui/`, sound in `apps/web/src/sound/`. Styling approach: ADR-0003. Files (images, sounds, music): `docs/design/ASSETS.md`.

## Rule: everything comes from global variables

Components use semantic tokens only (colors, the owl's colors, shadows, radii, spacing, type, durations, easings). No color, duration or shadow value is written inside a component. Derived colors (tints, glows, hover washes) are computed from the base tokens with `color-mix`, so changing one palette value updates everything that depends on it. Re-theming means editing `tokens.css`.

## Concept: game night

Playhoot is for playing social games with friends (backend `PROJECT_OVERVIEW.md`). The name gives the idea: an owl that hoots, a night of games. The identity aims for warm and playful, not childish, and quick to read on a phone held at arm's length.

- **Night sky** backgrounds: deep indigo with two soft glows and a few stars.
- **Owl-eye amber** as the one action color: what to press next is always amber.
- **Game pieces**: rounded shapes with a chunky bottom edge, so buttons, tiles and avatars feel like things you press or pick up.
- **Hoot**, the owl mascot, carries emotion in states that would otherwise be plain text: happy (default), surprised (something unexpected), sleepy (ended, lost, waiting too long), and blinking/bobbing as the loading indicator.

## Color

Dark only for now (`color-scheme: dark`).

| Role | Token | Value | Use |
| --- | --- | --- | --- |
| Background | `--color-bg` | night-900 `#141134` | Page |
| Surface | `--color-surface` | night-800 `#211c52` | Cards |
| Raised | `--color-surface-raised` | night-700 `#2c2669` | Secondary buttons, chips |
| Sunken | `--color-surface-sunken` | night-850 `#1a1642` | Inputs, list rows, empty tiles |
| Border | `--color-border` | night-600 `#3b3485` | Card and input outlines |
| Text | `--color-text` | `#f8f6ff` | Main text |
| Muted text | `--color-text-muted` | `#c9c2f2` | Secondary text |
| Primary | `--color-primary` | amber-400 `#ffc53d` | The main action, filled code tiles, "You" |
| Accent | `--color-accent` | coral-400 `#ff6f91` | Destructive or attention actions |
| Success | `--color-success` | mint-400 `#4ee0a6` | Live / OK signals |
| Danger | `--color-danger` | red-400 `#ff6b6b` | Errors |

Player colors are assigned by seat, in this order: amber, coral, mint, sky, violet, lime, orange, teal (`--player-1` … `--player-8`). Eight because the seed games allow up to eight players.

## Type

- Display and headings: **Fredoka** (variable): round and friendly, with strong weights for short titles.
- Body: **Nunito** (variable): rounded like Fredoka but very legible at small sizes.
- Both are self-hosted through `@fontsource-variable` packages: no requests to third-party font servers, which also keeps a future strict CSP simple.
- Sizes are tokens (`--text-xs` … `--text-display`); the larger ones scale with the viewport.

## Shape, space, depth

- Radii: 10 / 16 / 24 / 32 px and pill. Cards use 32, controls 16 to 24.
- Spacing: 4 px base (`--space-1` … `--space-8`).
- Depth: the press edge (`--edge: 4px`) under buttons, tiles and avatars; soft long shadows under cards.

## Components (web)

| Component | Notes |
| --- | --- |
| `Button` | primary / secondary / danger / ghost, md / lg, block, loading. Presses down on click. Disabled becomes a neutral piece rather than a faded amber. |
| `TextField` | Label above, hint or error below; error announced with `role="alert"`. |
| `Card` | The main container on every screen. |
| `CodeTiles` | A join code as letter tiles. Large tiles fill the space they are given and shrink with it. |
| `CodeInput` | Tiles with a transparent real input on top: typing, paste, mobile keyboards and screen readers behave as in a normal field. Filters to the join-code alphabet and uppercases. |
| `Avatar` | Seat-colored disc with an initial or seat number. |
| `Owl` / `Logo` | Mascot (moods, animated) and wordmark "play**hoot**". |
| `AppShell` / `Stage` | Top bar with logo, safe-area aware; centered column for single-task screens (480 px, or 960 px wide). |

## Motion

Lively and playful, never slow or in the way: things pop, bounce and settle in under half a second. Everything collapses under `prefers-reduced-motion`.

- Tokens: `--duration-instant` (presses) · `--duration-fast` · `--duration-base` · `--duration-enter` (entrances) · `--duration-celebrate`; `--stagger-step` between siblings; easings `--ease-out`, `--ease-bounce`, `--ease-spring`.
- Global vocabulary (`motion.css`): `motion-rise`, `motion-pop`, `motion-fade`, `motion-bump`, `motion-hop`, `motion-shake`, and `motion-cascade` (children enter one after another; every `Stage` uses it, so every screen enters in a cascade). Stagger siblings with `--motion-index`.
- In use: screens cascade in; buttons press down; code tiles pop as they fill; lobby players pop in one after another; the player count bumps when it changes; the owl blinks (each owl on its own rhythm), bobs while loading, hops when celebrating and shakes when something went wrong; confetti in the player colors when a game starts or is won; the background stars twinkle.
- CSS Modules rename keyframes per file, so shared animations are applied with the global classes, not referenced by name from module CSS.

## Sound

Toy-like, musical and soft (`docs/design/ASSETS.md` for the sound direction). Web Audio player in `apps/web/src/sound/`:

- On by default; the speaker button in the top bar mutes everything (remembered per browser). Audio starts after the first tap or key press, as browsers require.
- `Button` plays a soft tap by default (`sound` prop to change or silence it); the code input ticks per letter; the lobby plays a welcome, a pop per player joining, a blip per player leaving, and loops quiet lobby music; the game start plays a fanfare; endings play an error bonk, a farewell chime or a leave whoosh.
- A missing sound file plays its placeholder tones, so the experience is complete while assets are pending. `/design` has a sound board to hear every sound.

## Voice and languages

Short, warm, direct; talk to the player as "you" ("tú" in Spanish, "você" in Portuguese); say what happened and what to do next. Every way a join can end has a title, a sentence and one or two actions (`apps/web/src/features/session-join/outcomeCopy.ts`).

The UI is in Spanish, English and Brazilian Portuguese (French planned), switched from the language picker in the top bar of every page. All text lives in the message catalogs (`apps/web/src/i18n/messages/`); the rules are in `docs/engineering/standards/user-facing-text.md`.

## Responsive behavior

Mobile first, checked at 320, 390 and 1280 px without horizontal scrolling.

Adaptive layouts (plan §6, step 8, 2026-10-20, the agent's proposal for the human to react to): every screen has one of two skeletons, chosen once per route by `selectLayout` (`apps/web/src/features/layout.ts`) from the device capabilities, never by scattered checks:

- `compact`: a portrait display, or one narrower than 600 px. One column: the greeting (logo or owl) above the task, the invitation above the players, the game below a bar with the seat and Leave.
- `wide`: a landscape display at least 600 px wide (a phone held sideways, a landscape tablet, a desktop window). Side by side: the greeting beside the form (`SplitStage`, so the form stays whole above a phone keyboard), the invitation beside the players, and the game immersive: no top bar, a rail beside the game with the seat, the sound button and Leave, so the game gets the whole height.

Screens that are one centered message (connecting, the outcomes, "game on") have a single skeleton. Inside each skeleton, sizes still follow the responsive tokens (`clamp` type, spacing). `/design` has a compact / wide switch to review both on any display.

## Open questions for the human

1. ~~Overall direction~~: approved by the human on 2026-10-20.
2. ~~Language of the UI~~: decided 2026-10-20: Spanish, English and Portuguese now, French later (`docs/engineering/standards/user-facing-text.md`). Open: fallback for devices in other languages is English; Spanish instead?
3. **Light theme**: dark only for now. Needed?
4. **The owl**: keep Hoot as mascot and loading indicator? Name it?
5. **Other players' names**: the lobby shows "Player 2" because the backend stores no names (BACKEND_CONTRACT.md G3). Should the backend return names in the lobby and the roster?
6. **Host experience**: there is no UI to create or start a game yet (a dev script stands in). When does it come?
