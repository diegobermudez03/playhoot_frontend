# Server logic

`server/game.ts` default-exports `defineGame({...})` from `@playhoot/game-server`. The server is the only authority: clients send requests, the server decides.

## defineGame

| Field | Required | Meaning |
|---|---|---|
| `players` | yes | `{ min, max }` participants a Session may start with (1 ≤ min ≤ max). Participants are named `P1`, `P2`, … in join order. |
| `commands` | no | The commands players may send, from `defineCommands` in `shared/`. |
| `inputs` | no | Continuous inputs, from `defineInputs` (see Inputs below). |
| `setup(players)` | yes | Returns the initial state. `players` is the list of participant ids. |
| `on` | no | One handler per command, keyed by command name. A phase's `submit` command needs none (`phases.md`). |
| `phases`, `firstPhase` | no | Timed phases with private submissions, run by the platform (`phases.md`). |
| `input(state, ctx)` | no | Called for each change of a player's inputs. |
| `update(state, ctx)` | no | Called about every 100 ms while the game runs. |
| `leave(state, ctx)` | no | A player left or lost the connection for good. |
| `rejoin(state, ctx)` | no | A player who left comes back; return `true` to accept. Without it nobody comes back. |
| `view(state, player, ctx)` | yes | What one player sees. `ctx` holds `now`, and with phases `phase`, `submitted` and `mine` (`phases.md`). |

## State

- Plain JSON (objects, arrays, strings, numbers, booleans, null). No functions, Maps, Sets, Dates or classes.
- Handlers change it in place: `state.score[player] += 1`. Each call receives a fresh copy; there is nothing to return.
- At most 256 KiB. Each view, each command answer and each call's events and errors are bounded the same way.

## Commands

Declared once in `shared/`, so the server and the client agree:

<!-- example: fixtures/sdk-games/number-guess/shared/actions.ts -->
```ts
export const commands = defineCommands({
  guess: { value: { type: 'number', min: 1, max: 100, default: 50 } },
  pass: {},
});
```

Field types:

| Form | Value |
|---|---|
| `'boolean'`, `{ type: 'boolean', default? }` | `boolean` (default `false`) |
| `'number'`, `{ type: 'number', min?, max?, default? }` | finite number (default `0`) |
| `'string'`, `{ type: 'string', nullable?, default? }` | string up to 256 bytes in UTF-8 (default `""`, or `null` when nullable) |
| `'vector2'`, `{ type: 'vector2', default? }` | `[x, y]` (default `[0, 0]`) |
| `['a', 'b']`, `{ type: 'enum', values, default? }` | one of the values (default: the first) |

Every field has a default, and it must be a valid value of the field. When a field gives none, its natural default above is used; if that one breaks the field's own rules, the field must declare `default`. For example `{ type: 'number', min: 1, max: 100 }` is refused because its natural default `0` is below `min`: write `{ type: 'number', min: 1, max: 100, default: 50 }`. `min` and `max` belong only to numbers, `nullable` only to strings, and enum values must be distinct and not empty. The build reports a declaration the platform would refuse as a `manifest` diagnostic.

Names start with a letter and hold up to 64 letters, digits or `_`. At most 64 commands and 32 inputs (and 32 fields per command). The platform checks every payload against the declaration and fills missing fields with their defaults before your handler runs; a payload that does not match never reaches the game.

## Handlers

A command handler gets the state and a context:

| Context field | Meaning |
|---|---|
| `player` | Who sent it. |
| `payload` | The validated payload, typed from the declaration. |
| `now` | Session time of this operation, in ms since the game started. |
| `elapsed` | ms since the previous operation. |
| `emit(event, to?)` | Sends an event to everyone, or to the given player(s). |
| `error(player, error)` | Tells one player their action was wrong. |
| `finish()` | Ends the game after this operation. Each player keeps the last view. |

The handler's return value is the answer the sender's `useCommand` call receives: nothing → `{ ok: true }`, a value → `{ ok: true, value }`, `reject(code, details?)` → `{ ok: false, code, details }`.

**Validate before changing the state.** A rejection does not undo changes made before it.

`input`, `update`, `leave` and `rejoin` get the same context without `payload` (`input` has `inputs`, `leave`/`rejoin` have `player`, `update` has no `player`).

## Inputs

`defineInputs({ move: 'vector2', boost: 'boolean' })` declares continuous inputs, sent as whole snapshots and delivered to `input` on every change. The client sends them with `useInputs` (`client.md`); scenarios send them as `inputs` steps (`scenarios.md`). A field missing from a snapshot takes its default.

## Time

- Every ~100 ms the platform runs one step: pending inputs and commands in arrival order, then `update` at the step's time.
- A command does not wait for the next step: it runs at its arrival, with the inputs that arrived before it, followed by `update` at that time.
- There are no timers. Keep deadlines in the state (`endsAt: now + 15000`) and check them in `update`.
- `Date.now()` and `new Date()` give Session time (0 at start), never the real clock.
- `Math.random()` is seeded per Session (a scenario with the same seed repeats exactly). It throws inside `view`.

## Players coming and going

- A player whose connection drops for more than 3 seconds, or who leaves, triggers `leave`.
- When the last participant leaves, the Session ends.
- With `rejoin`, a player who left may come back if it returns `true`.

## Sandbox rules

The server code is checked before it is accepted (`building.md`). At the top level of every `server/` and `shared/` file only these are allowed:

- `import` and `export` declarations, types and interfaces;
- `function` declarations;
- `const` bindings holding literals, objects and arrays of literals, functions, other constants, or calls to `defineGame`, `defineCommands`, `defineInputs`.

Not allowed:

- at the top level: `let`, `var`, classes, enums (use a union of strings: `type Phase = 'ask' | 'reveal'`), destructuring, any statement such as a call; top-level constants are frozen when the script loads, so changing them fails;
- anywhere: `eval`, `Function`, `globalThis`, `Reflect`, `WebAssembly`, `.constructor`, `.prototype`, `__proto__`, `async`/`await`, generators, dynamic `import()`;
- the top-level names `start`, `command`, `samples`, `update`, `playerDisconnected`, `playerRejoined`, `project` and anything starting with `__playhoot` (the platform generates them).

Everything inside functions is ordinary TypeScript.

## Failures

A handler that throws, runs longer than 5 seconds or uses more than 64 MiB ends a real Session as aborted. Use `reject` for rule violations, never exceptions. Simulate before asking the person to play (`scenarios.md`).

## Limits a game observes

Each player may send at most 10 commands a second (120 a minute) and the whole Session 60 a second; more are refused before reaching the game.
