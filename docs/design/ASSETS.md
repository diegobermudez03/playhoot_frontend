# Assets

Status: LIVING LIST — owned by the human (sourcing), maintained by agents (registration)

Every image and sound the frontend uses. The app is built as if they all exist: while a file is missing, the app still works (sounds play placeholder tones, icons fall back to the browser default, link previews have no image).

## How it works

- **Registry**: `apps/web/src/assets/assets.json` lists every asset (id, kind, path under `apps/web/public`). Code refers to assets by id through it.
- **Check**: `npm run assets` lists which files exist and which are missing, and fails if an asset in the registry is not documented here.
- **Adding an asset (agents)**: register it in `assets.json`, use it by id, and document it below with its spec and a generation prompt. Never leave an asset only in code.
- **Delivering an asset (human)**: drop the file at its path, run `npm run assets`, and change its status here to DONE.

Hear and see what exists: `npm run dev` → `http://localhost:5173/design` (Sounds section plays every sound; missing ones play their placeholder tone).

## General direction

Same identity as the UI (`docs/design/DESIGN_SYSTEM.md`): "game night", warm, playful, rounded, never childish. Palette: night indigo `#141134`, owl violet `#7b6cf6`, amber `#ffc53d`, coral `#ff6f91`, mint `#4ee0a6`.

**Sounds**: short, soft, toy-like and musical (marimba, plucks, wooden blocks, glockenspiel, soft synth bells), all in the same key family (C major works) so they sound good together. Normalize to about −16 LUFS, trim silence at the start, no clicks. Format: MP3 (or OGG + MP3), 44.1 kHz, mono is fine for effects.

## Images

| Id | Path | Status | Spec | Where it is used |
| --- | --- | --- | --- | --- |
| `icon.favicon` | `/favicon.svg` | DONE (agent) | SVG of Hoot on a night square | Browser tab |
| `icon.apple-touch` | `/assets/icons/apple-touch-icon.png` | MISSING | 180×180 PNG, opaque night background, Hoot centered, no transparency | iOS home screen |
| `icon.app-192` | `/assets/icons/icon-192.png` | MISSING | 192×192 PNG, Hoot on night background, rounded square | Android home screen, install |
| `icon.app-512` | `/assets/icons/icon-512.png` | MISSING | 512×512 PNG, same as 192 | Install splash, stores |
| `icon.app-maskable-512` | `/assets/icons/icon-maskable-512.png` | MISSING | 512×512 PNG, full-bleed night background, Hoot within the central 80% safe zone | Android adaptive icon |
| `image.og-share` | `/assets/images/og-share.png` | MISSING | 1200×630 PNG/JPG under 300 KB | Preview card when a join link is shared (WhatsApp, Discord, X…) |

Notes:

- The icons can be exported from `apps/web/public/favicon.svg` (any SVG → PNG tool) if no new art is made. A professional illustration of Hoot would be better for the store-size ones.
- Prompt idea for `image.og-share`: *"Playful flat vector illustration for a party game website banner, 1200×630. Deep indigo night sky with a few stars, a cute round violet owl mascot with big amber eyes and small ear tufts, smiling, surrounded by floating game pieces (cards, dice, letter tiles) in amber, coral and mint. Space on the left for the word 'playhoot' in a rounded bold font. Clean shapes, soft shadows, no text other than the logo."*

## Sounds

| Id | Path | Status | Length | When it plays | Description / prompt |
| --- | --- | --- | --- | --- | --- |
| `sound.tap` | `/assets/sounds/tap.mp3` | MISSING | 40–80 ms | Any button press | Soft, muted wooden/plastic tap, like pressing a toy button. Very subtle (it plays often). |
| `sound.key` | `/assets/sounds/key.mp3` | MISSING | 30–60 ms | Typing a letter of the join code | Light, bright "tick", like placing a letter tile. Slight pitch variety welcome later. |
| `sound.erase` | `/assets/sounds/erase.mp3` | MISSING | 40–80 ms | Deleting a letter of the join code | Softer, lower version of `key`, like lifting a tile. |
| `sound.copy` | `/assets/sounds/copy.mp3` | MISSING | 150–250 ms | Invite link copied | Two-note rising "ding-ding", cheerful confirmation. |
| `sound.join` | `/assets/sounds/join.mp3` | MISSING | 400–700 ms | You enter the lobby | Short welcoming arpeggio (C–E–G), bright and warm. "You're in!" |
| `sound.player-joined` | `/assets/sounds/player-joined.mp3` | MISSING | 150–300 ms | Another player enters the lobby | Playful "pop" + rising blip, like a bubble appearing. |
| `sound.player-left` | `/assets/sounds/player-left.mp3` | MISSING | 150–300 ms | A player leaves the lobby | Gentle descending blip, not sad, just "bye". |
| `sound.game-start` | `/assets/sounds/game-start.mp3` | MISSING | 0.8–1.5 s | The game starts ("Game on!") | Short celebratory fanfare/jingle with a little sparkle at the end; exciting but not loud. |
| `sound.error` | `/assets/sounds/error.mp3` | MISSING | 200–400 ms | A join fails (code not found, full, connection lost…) | Soft cartoon "bonk" or two descending notes; friendly, not alarming. |
| `sound.ended` | `/assets/sounds/ended.mp3` | MISSING | 0.5–1 s | The game or lobby ends | Gentle closing three-note descending chime. |
| `sound.leave` | `/assets/sounds/leave.mp3` | MISSING | 200–400 ms | You leave the game | Soft "whoosh" or two falling notes. |

## Music

| Id | Path | Status | Length | When it plays | Description / prompt |
| --- | --- | --- | --- | --- | --- |
| `music.lobby` | `/assets/music/lobby-loop.mp3` | MISSING | 30–90 s, seamless loop | While waiting in the lobby (low volume; the sound button mutes it) | Relaxed, playful "waiting room" groove: soft marimba, light percussion, warm bass, ~100 BPM, no vocals, no build-ups or drops; must loop without a gap. Prompt idea for a music generator: *"cozy upbeat lofi game lobby loop, marimba and soft plucks, light shaker, warm bass, 100 bpm, playful, night time, seamless loop, no vocals"*. |

## Sources

AI generators (music: Suno/Udio/Stable Audio; effects: ElevenLabs Sound Effects; images: any image model) or libraries (freesound.org with CC0 license, Kenney.nl game assets — CC0, Pixabay). Keep a note of the license of anything not generated: record it in the Status column (e.g. "DONE · CC0 Kenney").
