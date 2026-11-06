# Scenarios

A scenario plays a built revision with scripted players and checks what happened: the platform runs it with the same rules as a real Session, faster than real time (30 seconds of play take under a second), and checks your expectations for you. The answer is a short summary; the states stay on the server for 30 minutes and you read only the ones you need.

## Scenario

<!-- example: fixtures/sdk-games/drift/scenarios/one-player.json -->
```json
{
  "format": "playhoot.scenario.v1",
  "players": 1,
  "seed": 5,
  "duration_ms": 4000,
  "observe_at_ms": [0, 1100, 3000],
  "holds": [
    {
      "from_ms": 100,
      "to_ms": 1100,
      "player": "P1",
      "inputs": {
        "move": [1, 0]
      }
    }
  ],
  "expect": [
    {
      "at_ms": 0,
      "path": "positions.P1",
      "op": "eq",
      "value": [20, 45]
    },
    {
      "at_ms": 1100,
      "path": "positions.P1[0]",
      "op": "gt",
      "value": 20
    },
    {
      "at_ms": 3000,
      "path": "moves.P1",
      "op": "eq",
      "value": [0, 0]
    },
    {
      "at_ms": 1100,
      "of": "P1",
      "path": "me",
      "op": "eq",
      "value": "P1"
    },
    {
      "path": "winner",
      "op": "eq",
      "value": null
    }
  ]
}
```

- `revision`: optional, default the current one; it needs a `SUCCEEDED` build.
- `players`: within the game's `players` range. Participants are `P1`…`Pn`.
- `seed`: optional, default 1. The same scenario with the same seed gives the same result.
- `duration_ms`: game time to play, at most 10 minutes. The scenario stops earlier when the game finishes.
- `steps`: `{ "at_ms", "player", "command": { "name", "payload" } }` or `{ "at_ms", "player", "inputs": { ...the whole input snapshot } }`. Steps at the same instant keep their order.
- `holds`: `{ "from_ms", "to_ms", "player", "inputs" }` keeps those inputs from `from_ms` and releases them at `to_ms` (every input back to its default). Use them for movement instead of pairs of steps. Holds of one player may not overlap.
- `observe_at_ms`: instants to observe. Each is taken at the first 100 ms step at or after it. Instants after the game finished are not observed; the end covers them.
- `expect`: what must be true, checked by the platform. See below.
- Limits: 2000 steps, 500 holds, 50 observed instants (the expectations' included), 100 expectations, 1 MiB.

## Expectations

`{ "at_ms"?, "of"?, "path", "op", "value"? }`:

- `at_ms`: the instant (it is observed for you). Leave it out to check the end of the run. An instant after the game finished is checked on the final state; one the run never reached (the script failed, the budget ran out) fails as `not_observed`.
- `of`: `global` (default), the authoritative state the server keeps; or `P1`, `P2`… for what that player sees (their view). Check private information here: a player's view must not reveal what they should not know.
- `path`: keys separated by dots, `[n]` for array items: `scores.P1`, `hand[0].rank`. Empty is the whole value.
- `op`: `eq`, `ne` (any JSON value), `exists`, `absent` (no value), `lt`, `lte`, `gt`, `gte` (a number), `in` (an array of accepted values), `len` (the length of an array, object or string).

Write the rules agreed with the person as expectations: they are checked the same way every time, and the person can rerun them.

## Saved scenarios

Scenarios worth keeping live in the project as `scenarios/<name>.json` (they are checked when written: a broken one is refused with `invalid_scenario`). Run them by path, or all at once:

- `{ "scenario_path": "scenarios/first-to-goal.json" }`
- `{ "all": true }`: every saved scenario (at most 10), a summary each and `passed` for all.

Add `"revision"` to run them on an earlier revision. After a change, run them all again: they are the game's regression tests.

## Sending it

- Without HTTP: give it to the person, who pastes it (or runs the saved ones) in **Escenarios** (id `scenarios`) and sends you the result.
- With HTTP: `POST <link>/simulations` with the scenario, or with `scenario_path` / `all`.
- With MCP: `simulate` (`scenario`, `scenario_path` or `all`).

## Result

The default answer is a summary:

```text
format            "playhoot.simulation-summary.v1"
result_id         to read states while it is kept; expires_at says until when
revision          the revision played; toolchain_version, the build's tools
players, seed
passed            true when every expectation held (absent without expectations)
expectations      { total, passed, failed: [{ index, at_ms, of, path, op, expected, actual, not_observed?, problem? }] }
finished          true when the game called finish(); then finished_at_ms
stopped           "duration" | "finished" | "budget" | "script_error"
observed_at_ms    the instants whose states can be read
counts            { commands, rejected, events, errors }
rejected, errors  the first 10 of each
script_error      { at_ms, message }   only when a handler threw
```

- `stopped`: `duration`, `finished` (with `finished_at_ms`), `budget` (the run used its real time or output size; what happened so far is kept) or `script_error`.
- `rejected`: steps that never reached the game, with `reason` `invalid` (does not match the declarations) or the name of a limit (`server.md`).
- `errors`: what `error` sent, with its player.
- For `all`: `{ "format": "playhoot.simulation-batch.v1", "passed", "scenarios": [{ "path", "summary" | "diagnostics" }], "skipped" }`.
- `"detail": "full"` next to the scenario answers everything at once instead (`playhoot.simulation-result.v1`: every observation's state and views, the final one, each command's answer, every event and error). Prefer the summary and read states on demand: it costs far less.

## Reading a state

`GET <link>/simulations/<result_id>/state?at_ms=1100&of=P1&path=positions` (MCP `read_simulation_state`): one value of one observation. Leave `at_ms` out for the end, `of` for the global state, `path` for the whole value. A value over 64 KiB answers its `size` and `keys` (or `length`) instead: ask for a narrower path. `404` `not_observed` lists `observed_at_ms`; `simulation_not_found` means it expired: run the scenario again.

## Refusals

- `409 build_not_ready`: the revision has no `SUCCEEDED` build.
- `422 invalid_scenario` with `diagnostics` `[{"field","message"}]`.
- `404 scenario_not_found`: no saved scenario at `scenario_path`.
- `503 simulations_busy`: retry after the `Retry-After` seconds.
