# ADR-0007: Client telemetry sent to the backend, classified in one place

Status: ACCEPTED
Created: 2026-10-21
Last status change: 2026-10-21
Supersedes: None
Superseded by: None

## Context

Plan §17 asks the frontend to tell errors apart by origin (presentation, bridge/contract, transport, backend logical rejection, artifact/GameHost) and to measure at least artifact load time, time to GameHost READY, reconnections, bridge validation failures, WebSocket disconnects, resyncs and artifact errors. Until now these went to the browser console in development only: the platform could not see what players experience.

No observability provider exists yet: the backend's metrics are written to its request logs only (backend Engineering Radar, "A metrics provider for server and client metrics"). A client can send anything, so its telemetry cannot be trusted.

The human asked for the common pattern and chose on 2026-10-21 to send client telemetry to the backend, which records it with its own metrics (the "tunnel" pattern of real-user monitoring), rather than a console only or picking a provider now.

## Decision

**One classification point.** Features report what happened in their own terms (Join: closes, reconnections, resyncs, outcomes, identity failures; Session Play: load and READY times, refused game messages, GameHost failures). The web app turns them into the backend's closed catalog in `apps/web/src/telemetry/classify.ts`, classifying every error by origin and kind. Render failures caught by the route error boundary are presentation errors. Ending, leaving and being replaced are not errors; a game stopped for misbehaving is counted as its GameHost failure.

**Batches to the backend.** `createTelemetryReporter` (`@playhoot/communication`) queues events, coalesces counted ones into one with a count, and posts batches to `POST /v1/client-telemetry` every 30 s, sooner when 50 are waiting, and once more with `keepalive` when the tab is hidden or the page goes away. It sends only once an identity exists (any guest's), holds at most one batch (100 events), and drops a batch that fails: telemetry is best effort and never retried. Development builds also print every event.

**The backend owns the catalog.** `api/clienttelemetry` checks every event against a closed catalog (names, label values, ranges) and records it as a `client_*` metric; anything else is dropped and counted. The frontend's types (`@playhoot/protocol`, `clientTelemetry.ts`) mirror it.

**Untrusted by design.** These metrics are trends of what players experience. They are never evidence about a user or a game: that is the backend's game fault and limit audit (ADR-0006), recorded server side.

## Alternatives Considered

- **Console only until a provider exists.** Rejected by the human: the platform would see nothing.
- **A hosted real-user-monitoring provider now** (Sentry, Datadog RUM, Grafana Faro with OpenTelemetry). A platform decision (account, cost, deployment) the backend also has pending; the batches and the catalog would stay, only the backend's side changes when it is chosen.
- **Sending each event as it happens.** Rejected: one request per event costs the device and the backend; batches with coalesced counts cost one request every 30 s at most.

## Consequences

- Client metrics are visible only where the backend's metrics are: its logs, until a provider is integrated behind `monitoring/metrics`.
- Events that happen before any identity exists wait in the queue (at most a batch) until one does.
- A tab closed abruptly may lose its last batch; `keepalive` on hide covers the usual mobile case.
- Adding an event is a change on both sides: the backend catalog first, then the frontend types and classification.

## Canonical Knowledge Impact

- `docs/architecture/BACKEND_CONTRACT.md`: `POST /v1/client-telemetry`.
- `docs/logic/`: the telemetry call and when it is made.
- Backend repository: `api/README.md` (client telemetry route group), Identity's `REPORT_CLIENT_TELEMETRY`.
