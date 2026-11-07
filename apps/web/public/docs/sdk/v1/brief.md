# Brief

`brief.json` keeps the game agreed with the person, while it is written, and the phase the work is in. Whoever continues the game (another conversation, another agent, the person) reads it first: the link and `get_game_context` show it at the top.

**Required:** agree the game with the person and write the brief before writing code. **Recommended:** keep it current: when the person changes a rule, change the brief in the same change as the code.

## The file

<!-- example: fixtures/sdk-games/number-guess/brief.json -->
```json
{
  "format": "playhoot.brief.v1",
  "phase": "ready",
  "players": {
    "min": 2,
    "max": 6
  },
  "goal": "Guess the secret number from 1 to 100 before the others.",
  "loop": "Players take turns; the player whose turn it is guesses or passes, and a guess gets a hint: higher or lower.",
  "actions": ["Guess a number from 1 to 100 on your turn.", "Pass your turn."],
  "private_information": ["The secret number, until the game ends."],
  "rounds": "Turns of 15 seconds, in join order; a player who runs out of time loses the turn.",
  "scoring": "No points: the first right guess wins.",
  "ending": "A player guesses the number.",
  "capabilities": [
    "Commands",
    "Time and deadlines",
    "Randomness",
    "Private information",
    "Events and errors",
    "Leaving and rejoining"
  ],
  "assets": [],
  "open_questions": []
}
```

Every field but `format` is optional; write what is agreed and leave the rest out.

| Field | What it holds |
|---|---|
| `format` | Always `playhoot.brief.v1`. |
| `phase` | Where the work stands (below). Default `brief`. |
| `players` | `{ "min", "max" }`, as `defineGame` will declare them. |
| `goal` | How a player wins, in one or two sentences. |
| `loop` | What happens again and again while playing. |
| `actions` | What a player can do, one per item. These become commands or inputs. |
| `private_information` | What some players must not see, and until when. Each item becomes an expectation on a player's view (`scenarios.md`). |
| `rounds` | How the game is divided in time: rounds, turns, phases, durations. |
| `scoring` | How points are earned, if any. |
| `ending` | When the game ends and who wins. |
| `capabilities` | The capabilities it needs, named as in `capabilities.md`. |
| `assets` | The images, audio or video it needs (`assets.md`, `policies.md`). |
| `assessment` | For a class: what it checks or teaches. |
| `open_questions` | What is still undecided; ask the person before deciding it yourself. |

Texts hold at most 2000 characters; lists at most 50 items of 500 characters. Unknown fields are refused. A `brief.json` that breaks these rules is refused when written (`invalid_brief`, with the field), so the brief anyone reads is always valid. A project may have no brief: it still builds and publishes.

## Phases

| Phase | The work |
|---|---|
| `brief` | Agreeing the game with the person. |
| `foundation` | Choosing the starting point (a template, or the starter project) and shaping it into this game. |
| `building` | Writing the rules and the screen, build after build. |
| `testing` | Checking the agreed rules with scenarios and expectations, and fixing what fails. |
| `assets` | Drawing or uploading what the game shows and plays. |
| `ready` | Built, tested, its assets in place: the person plays it and decides to publish. |

**Recommended:** move the phase forward in the same change that finishes a step, and back when a step must be redone (a rule changed: back to `building`). The order of work is in `policies.md`.
