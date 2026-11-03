# Scenarios

A scenario plays a built revision with scripted players and answers what happened: the whole state and every player's view at the instants you ask for, and at the end. It runs the same rules as a real Session, faster than real time (30 seconds of play take under a second). Nothing is kept.

## Scenario

<!-- example: fixtures/sdk-games/number-guess/scenarios/two-players.json -->
```json
{
  "format": "playhoot.scenario.v1",
  "players": 2,
  "seed": 7,
  "duration_ms": 40000,
  "steps": [
    { "at_ms": 500, "player": "P1", "command": { "name": "guess", "payload": { "value": 50 } } },
    { "at_ms": 600, "player": "P1", "command": { "name": "guess", "payload": { "value": 60 } } },
    { "at_ms": 1000, "player": "P2", "command": { "name": "pass" } }
  ],
  "observe_at_ms": [700, 20000]
}
```

- `revision`: optional, default the current one; it needs a `SUCCEEDED` build.
- `players`: within the game's `players` range. Participants are `P1`…`Pn`.
- `seed`: optional, default 1. The same scenario with the same seed gives the same result.
- `duration_ms`: game time to play, at most 10 minutes. The scenario stops earlier when the game finishes.
- `steps`: in time order; steps at the same instant keep their order. Each is a `command` (`name`, `payload`) or `inputs` (the player's whole input snapshot).
- `observe_at_ms`: instants to observe. Each is taken at the first 100 ms step at or after it. Instants after the game finished are not observed; `final` covers them.
- Limits: 2000 steps, 50 observations, 1 MiB.

## Sending it

- Without HTTP: give it to the person, who pastes it in **Escenarios** (id `scenarios`), runs it and sends you the result.
- With HTTP: `POST <link>/simulations`.

## Result

```text
format        "playhoot.simulation-result.v1"
revision      the revision played
players       ["P1", ...]
seed          the seed used
finished      true when the game called finish(); then finished_at_ms
stopped       "duration" | "finished" | "budget" | "script_error"
simulated_ms  game time played
boundaries    100 ms steps (and command steps) run
observations  [{ requested_at_ms, at_ms, state, views: { "P1": <view>, ... } }]
final         { at_ms, state, views }
commands      [{ at_ms, player, name, response }]
rejected      [{ at_ms, player, kind: "command" | "inputs", reason, detail? }]
events        [{ at_ms, to?, event }]
errors        [{ at_ms, player, error }]
script_error  { at_ms, message }   only when a handler threw
```

- `stopped`: `duration`, `finished` (with `finished_at_ms`), `budget` (the simulation ran out of real time or output size; what happened so far is kept) or `script_error`.
- `commands`: each command's answer, as `useCommand` would receive it.
- `rejected`: steps that never reached the game, with `reason` `invalid` (does not match the declarations) or the name of a limit (`server.md`).
- `events`, `errors`: what `emit` and `error` sent, with their recipients.
- `script_error`: `{"at_ms","message"}` when a handler threw; the result keeps what happened before.

Compare the views with the rules agreed with the person. Check the private information too: a player's view must not reveal what they should not know.

## Refusals

- `409 build_not_ready`: the revision has no `SUCCEEDED` build.
- `422 invalid_scenario` with `diagnostics` `[{"field","message"}]`.
- `503 simulations_busy`: retry after the `Retry-After` seconds.
