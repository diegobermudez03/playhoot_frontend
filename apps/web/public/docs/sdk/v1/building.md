# Building

Every new revision (a change, a restore, an asset upload or removal) is built automatically, in the background. When several revisions arrive quickly, only the newest is built; the older ones end `SUPERSEDED`. A revision whose sources and assets equal an earlier built one reuses that build at once.

## Stages

A build stops at the first stage that fails:

| Stage | Checks |
|---|---|
| `project` | `game.project.json` and the required files. |
| `source` | Per-file rules: imports per area and the sandbox rules (`server.md`). |
| `types` | TypeScript type check (strict, without checked index access or exact optional properties). |
| `bundle` | Bundling the server script and the client page. |
| `runtime` | Starting the game with its minimum players and computing each view once. |
| `sandbox` | The platform's own check of the server script. |
| `manifest` | The declarations derived from `defineGame` (commands, inputs, players). |
| `infrastructure` | The platform failed, not the game. Nothing to fix in the code; another change builds again. |

## Reading the result

Read the link again, or wait: `GET <link>/build?revision=N&wait=20` answers as soon as that revision's build ends, or after 20 seconds with its current status. A build takes a few seconds.

Status: `QUEUED`, `RUNNING`, `SUCCEEDED`, `FAILED`, `SUPERSEDED`. A diagnostic:

```json
{ "stage": "types", "file": "server/game.ts", "line": 20, "column": 13, "message": "Property 'tapz' does not exist on type 'State'." }
```

Fix every diagnostic of the failed build in one change when you can. The link also shows the last successful build, so you know what still works. Scenarios and the preview need a `SUCCEEDED` build of the revision they use.
