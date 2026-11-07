# Policies

How to build a game with a person on Playhoot, cheaply and safely. Rules are marked as in `index.md`.

## Order of work

1. **Required:** agree the game with the person before writing code: players, goal, how a round goes, the actions, what each player may see, scoring, how it ends, and the assets it needs. Write it in `brief.json` (`brief.md`), with `phase` `brief`, and move the phase forward as the work does.
2. **Recommended:** look for a template that already plays close to that game and start from it (`templates.md`); when none fits, say so and use the starter project. Never start from an example of this guide: examples teach the SDK, templates are made to be changed.
3. **Recommended:** make the smallest change that moves the game forward, with find/replace edits (`changes.md`). Configure what exists (a number, a list of questions, a text) before rewriting behavior.
4. **Required:** wait for the build of your revision and fix its diagnostics before anything else (`building.md`).
5. **Required:** check the agreed rules with scenarios and expectations (`scenarios.md`), and save the ones worth keeping under `scenarios/`.
6. **Recommended:** resolve assets last, in the order below.
7. **Required:** ask the person to play it in **Probar juego** and confirm it plays as intended.
8. **Required:** never publish: the owner publishes in Playhoot.

## Done

A game is done when all of these hold:

- **Required:** the current revision's build `SUCCEEDED`.
- **Required:** saved scenarios with expectations cover the agreed rules, and running them all passes on the current revision.
- **Required:** every asset that is not `optional` is uploaded, or the game no longer declares it (it draws the thing instead).
- **Required:** the person played it and confirmed it.
- **Recommended:** `brief.json` holds the agreed game with `phase` `ready` and no `open_questions` left; `notes.md` keeps anything else worth knowing.

## Testing

- **Required:** after every change that touches rules, run the saved scenarios again (`{"all": true}`). A failure is a rule broken, or an expectation to update with the person's agreement: never silence it.
- **Required:** check private information with expectations on a player's view (`"of": "P2"`): what they must not see is absent or null.
- **Recommended:** one scenario per rule, short (seconds of game time), with a fixed seed; observe only the instants your expectations need and read states on demand instead of asking for everything.
- **Recommended:** write expectations from the rules agreed with the person, not from what the game happens to do.

## Assets

Prefer what costs nothing to load and nothing to make:

1. **Recommended:** HTML and CSS: shapes, colors, gradients, text, emoji.
2. **Recommended:** SVG written as React components in `client/`: icons, simple figures, boards. Keep each one small (tens of elements, short paths); never generate huge SVG (thousands of points, embedded images or traced bitmaps).
3. **Escape hatch:** files the person uploads, declared in `game.project.json` (`assets.md`): for photos, real sound and video, or a specific style the person asks for. Describe each one concretely.
4. **Escape hatch, last:** generated raster images, only when nothing above works and the person agrees.

Mark an asset `optional` when the game works without it, and always draw a fallback while it is not ready.
