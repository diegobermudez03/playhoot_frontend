# Playhoot Design System — Ink & Sticker

Status: **IN FORCE** since T-203 (2026-11-15). The creator chose the visual
direction **A — Ink & Sticker** at the close of T-202 (`../../../docs/agent/DECISIONS.md`,
C-03), with no adjustments. The contract render is
`../../../docs/agent/designs/c03/direction-a.html`; this system is that render
turned into tokens and components. The previous identity ("game night", the owl
Hoot, a dark indigo sky) is gone: its tokens, its mascot and its starfield no
longer exist in the code.

Gallery: `npm run dev` → `http://localhost:5173/design` (development only). It
shows every core component in its states, in both orientations, and the
implemented screens with fake state. **A task that adds a core component adds it
to the gallery in the same piece of work.**

Code: tokens in `apps/web/src/ui/tokens.css` (+ `tokens/`), motion in
`apps/web/src/ui/motion.css`, components in `apps/web/src/ui/`, sound in
`apps/web/src/sound/`. Files (images, sounds, music): `ASSETS.md`.

## The thesis

A tabletop-game box brought to the screen. Warm paper, honest near-black ink,
flat accent fills, visible 2 px outlines and **hard offset shadows with no
blur**. Buttons physically press down into their own shadow, cards sit slightly
askew like stickers, the mascot is a flat vector character with Lottie-style
blinks and tail swings.

It is deliberately *drawn* — the opposite of the gradient-and-glass default —
which answers P24's two requirements at once: it does not look AI-generated, and
ink on paper makes AA contrast the starting point rather than a retrofit.

No dark mode in phase 1 (D-021).

## Rule: three tiers, and components see only the middle one

D-021. Nothing below tier 2 may be named outside the token files.

| Tier | File | What it holds |
| --- | --- | --- |
| 1 · primitives | `ui/tokens/primitives.css` | The raw values of the direction: paper and ink scales, the accent fills, type, the 4 px space scale, radii, outline widths, shadow offsets, motion durations and easings, tilts. |
| 2 · semantic | `ui/tokens/semantic.css` | The roles components use: surfaces, ink, outline, focus, primary/accent/highlight/info/success/danger, shadows, player colours, the mascot's skin, the minimum target size. |
| 3 · component | each `*.module.css` | A component's own knobs, declared at the top of its own file (`--btn-bg`, `--btn-offset`, …). |

No colour, duration, shadow or radius value is ever written inside a component
or a screen. **ESLint does not read CSS**, so what enforces this is
`npm run styles` (`scripts/check-styles.mjs`, part of `npm run check`): it scans
every stylesheet outside the token files for a raw colour, a raw duration or a
shadow with a blur radius, and fails the check. A genuine exception goes in that
script's allow list with its reason — today there is one, the Google sign-in
button, whose colours Google's branding guidelines fix. Re-skinning means
editing tier 1.

## Colour

| Role | Token | Value |
| --- | --- | --- |
| Page (the board) | `--color-page` | `#e9e2d4` |
| Surface (paper) | `--color-surface` | `#faf6ef` |
| Sunken | `--color-surface-sunken` | `#f3ede2` |
| Raised (a card) | `--color-surface-raised` | `#ffffff` |
| Muted (disabled) | `--color-surface-muted` | `#e3dccd` |
| Ink | `--color-text`, `--color-outline`, `--color-focus` | `#23201c` |
| Ink, secondary | `--color-text-muted` | `#5c564d` |
| Ink, subtle | `--color-text-subtle` | `#6b6458` |
| Primary (the main action) | `--color-primary` | coral `#f4573c` |
| Accent | `--color-accent` | marigold `#ffc43d` |
| Highlight | `--color-highlight` | lilac `#c9b8f0` |
| Info | `--color-info` | sky `#9bd9f2` |
| Success | `--color-success` | teal `#2bc4a9` |
| Success, as text | `--color-success-text` | `#0a6355` |
| Danger, as text | `--color-danger-text` | `#b3261e` |

Player colours are assigned by seat (`--player-1` … `--player-8`): marigold,
teal, coral, sky, lilac, lime, rose, tangerine. Eight, because the seed games
allow up to eight players.

**Why this passes AA by construction.** Every control, tag, avatar and card is
bound by the same ink outline, so a component boundary never depends on its
fill: ink is ≥ 4.85:1 against any accent fill and ≥ 12.58:1 against any surface
(WCAG 1.4.11 needs 3:1). Text is ink on paper (12.6–16.2:1) or ink on a fill
(4.85–11.4:1). The two tiers of quieter ink were chosen so they also pass on the
darkest surface, the board: muted 5.63:1, subtle 4.54:1. The full table of
measured pairs is in the T-203 result (`../../../docs/agent/tasks/T-203.md`).

Tone is never carried by colour alone (WCAG 1.4.1): `Status` draws a mark
(`i ✓ ! ×`) beside its fill, an invalid control thickens its outline, and a
field error is prefixed by a circled `!`.

## Type

- Display and headings: **Fredoka** (variable). Body: **Nunito** (variable).
- Both OFL and self-hosted through `@fontsource-variable`: no request to a
  third-party font server, which keeps a future strict CSP simple (P25).
- Body text is set at weight 600 and labels at 800: on warm paper a light weight
  looks washed out.
- Sizes are tokens (`--text-xs` … `--text-display`); the larger ones scale with
  the viewport.
- Only those two families are shipped. `@fontsource/roboto` is loaded by the
  Google sign-in button alone, because Google's branding guidelines require
  their own type on it.

## Shape, depth and tilt

- Radii: 10 / 14 / 22 / 28 px and pill. Cards 22, controls 14.
- Space: a 4 px scale (`--space-1` … `--space-8`).
- Outline: 2 px (`--outline-width`), 3 px where something must shout (an invalid
  control, a modal, the focus ring).
- Depth is an **offset, not a blur**: `--shadow-sm/md/lg` are 2 / 4 / 6 px hard
  ink offsets. Pressing a control moves it by its own offset and removes the
  shadow, so it visibly goes down onto the board. Inputs use `--shadow-inset`
  instead: they are pressed *into* the paper.
- `--tilt-left` / `--tilt-right` are the small rotations that keep a surface from
  looking printed. Always decorative — a tilt never changes reading order.

## Focus

One indicator for the whole system, declared once in `tokens.css`: a 3 px ink
ring with a 2 px gap, which reads on white paper and on a coral button alike
(≥ 12.58:1 either way). A component may move it inwards where an outline would
be clipped (`ModeSwitch`) but never removes it. Pointer targets are at least
24 × 24 px (`--target-min`, WCAG 2.2 2.5.8); standard controls are 44 px high.

## The core components

All in `apps/web/src/ui/`, exported from `ui/index.ts`, all shared by the
horizontal and vertical implementations of every screen.

| Component | Notes |
| --- | --- |
| `Button` | primary / secondary / accent / ghost / danger, sm / md / lg, `block`, `loading`, `icon`. Presses into its own shadow. Disabled is a blank piece, not a faded action; it keeps its outline. |
| `Field` | The shared frame: label, control, one line of hint **or** error. Wires `id`, `aria-describedby` and `aria-invalid` for whatever control it holds. |
| `TextField` · `Select` | `Field` plus the shared control skin (`Control.module.css`). The select keeps the native list and draws its own arrow. |
| `CodeInput` · `CodeTiles` | A join code or a second factor as letter tiles, with a real transparent input over them: typing, paste, mobile keyboards and screen readers behave as in a normal field. `labelVisible` draws the label above the tiles, for a screen where the code is one task among several (the home page). |
| `Card` | default / flat / accent / highlight, optionally `tilted`. The main container on every screen. |
| `Dialog` | The native `<dialog>`: the browser traps focus, restores it on close and handles Escape. Nothing re-implements that. |
| `Status` · `StatusArea` · `ToastStack` | What just happened. `StatusArea` is an always-mounted live region that holds its space, so announcing something never shifts the layout. Toasts stack at the bottom above everything, clear of the PWA notices. |
| `Tag` · `Pill` | The outlined lozenge at two weights: a tag labels content (and can be removable), a pill states a status. |
| `Avatar` | Seat-coloured disc with an initial, sm / md / lg, `highlighted`. |
| `ModeSwitch` | The segmented control (the 3-mode switch, an orientation, a filter). A radio group, not tabs: it reveals nothing. `sm` is the tighter size, for a control that shares a line with others (the top bar). |
| `Skeleton` | text / block / circle. `aria-hidden`: loading is announced once by the live region, not by a row of empty boxes. |
| `EmptyState` | Mascot, one sentence and the way out. Never an error. |
| `PageHeading` | kicker, title, lead and the screen's actions, so headings keep one shape (WCAG 2.4.6). |
| `Mascot` | The mascot slot (below). |
| `Logo` | The mark (a tilted marigold sticker with the play triangle) plus "play**hoot**", the brand name, never translated. |
| `Confetti` | A one-off burst of ink-outlined paper scraps in the player colours. Removed entirely under reduced motion. |
| `AppShell` · `Stage` · `SplitStage` | The frame (below) and the two centred skeletons (480 px / 960 px). |

## The shell

`AppShell` is rendered **once, above the router** (`root.tsx`), not by each
screen: a navigation replaces what is inside `main` and never rebuilds the bar,
so the unread count, an open menu and the bar's own state survive it. A screen
says only how it wants to be framed, with `useShellMode`:

- `normal` — the whole bar. The default; a screen that says nothing gets it.
- `bare` — the bar without the logo, for a page that shows its own big one.
- `immersive` — no bar and a thin margin, while a game takes a landscape display.
- `plain` — no frame of ours. The admin area (D-023), which is recognised from
  the address so its pages never flash this bar first.

The bar itself (`app/shell/`) is `ShellBar` plus `NotificationsBell`,
`ModeChoice` and `ShellMenu`. What it shows at a given width is decided in
**CSS, not in JavaScript**: it is server-rendered before anything is known about
the display, and a bar that rearranged itself after hydration would move under
the reader's pointer. Entries the width cannot hold live in the menu instead:
the mode switch below 360 px, and join, create, the language and the sound below
760 px. The menu also holds the offer to install the app at every width, and
disappears entirely when that offer is the only thing it would hold and the
browser cannot install.

The first thing the keyboard reaches on any page is the skip link to `main`.
The pieces that need the browser (who the person is, the bell, the sound, the
install offer) render nothing until the page is interactive, so a public page
the server rendered is the same page with the same bar.

## The mascot slot

`Mascot` is a **slot, not a picture**. P24§3 asks for characters built from
reusable, code-drawn parts rather than one flat image, so the head, eyes, tail
and bounce are separate pieces driven by the motion tokens, and every colour is
a `--mascot-*` role.

What it draws today is the **placeholder** cat of the direction render,
registered as the pending asset `mascot.primary`. When the creator supplies or
approves the final character (`CREATOR_TODO.md` P-15), either this drawing is
replaced or a Lottie file is mounted in the same wrapper — every screen asks for
the slot, never for the drawing, so no screen changes.

Moods: `happy` (default), `surprised` (something unexpected), `sleepy` (ended,
waiting too long, nothing here). `animated` bobs it as the "something is
happening" indicator; `entrance` hops it for a celebration or shakes it when
something went wrong.

## Motion

Things arrive the way a sticker is pressed onto a board: a short pop with a
slight tilt, never a slow fade. Everything collapses under
`prefers-reduced-motion` — nothing in the system is needed to understand a
screen.

- Tokens: `--duration-instant` (presses) · `--duration-fast` · `--duration-base`
  · `--duration-enter` · `--duration-celebrate` · `--duration-idle` (the
  mascot's loops); `--stagger-step` between siblings; easings `--ease-out`,
  `--ease-bounce`, `--ease-spring`.
- Vocabulary (`motion.css`): `motion-rise`, `motion-pop`, `motion-fade`,
  `motion-bump`, `motion-hop`, `motion-shake`, the mascot's `motion-bob`,
  `motion-blink`, `motion-tail`, the placeholder's `motion-breathe`, and
  `motion-cascade` (children enter one after another; every `Stage` uses it).
  Stagger siblings with `--motion-index`.
- CSS Modules rename keyframes per file, so shared animations are applied with
  the global classes, never referenced by name from a module.

## Sound

Unchanged by T-203 (direction and files: `ASSETS.md`). Toy-like, musical and
soft; Web Audio player in `apps/web/src/sound/`; on by default, muted from the
top bar, remembered per browser; a missing file plays its placeholder tone.
`/design` has a board to hear every sound.

## Voice and languages

Short, warm, direct; talk to the player as "you" ("tú", "você"); say what
happened and what to do next. Every way a join can end has a title, a sentence
and one or two actions (`apps/web/src/features/session-join/outcomeCopy.ts`).

The UI is in Spanish, English and Brazilian Portuguese; all text lives in the
message catalogs (`apps/web/src/i18n/messages/`), rules in
`docs/engineering/standards/user-facing-text.md`.

## Responsive behaviour

Mobile first, checked at 320, 390 and 1280 px without horizontal scrolling.

Every screen has one of two skeletons, chosen once per route by `selectLayout`
(`apps/web/src/features/layout.ts`) from the device capabilities, never by
scattered checks:

- `compact`: a portrait display, or one narrower than 600 px. One column.
- `wide`: a landscape display at least 600 px wide. Side by side (`SplitStage`),
  and the game immersive: no top bar, a rail beside it, so the game gets the
  whole height.

A page the **server** renders has no device to ask about and no services behind
it, so it picks its skeleton with `useMediaLayout` instead: `compact` on the
server and on the first client render, the real answer right after. Same two
implementations, same breakpoint.

Inside each skeleton, sizes still follow the responsive tokens. `/design` has a
compact / wide switch and shows the core components in both orientations.

A component that is drawn on a server-rendered page must draw the same thing
twice: nothing random, no clock. `Mascot` gives each instance its own blink
rhythm from its React id, not from `Math.random()`, for exactly this reason.

## What T-203 did not decide

- **Screen redesigns.** D-006: the screens keep their structure; T-203 only
  swapped their tokens and fonts so the app stays coherent. Each screen is
  redesigned in its own milestone.
- **Dark mode.** None in phase 1 (D-021).
- **Game-side SDK visual components.** H7, P24§3.
- **The final mascot and the four app icons.** The creator's, P-14 and P-15.
