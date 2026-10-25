import type { ConnectionCloseKind } from '@playhoot/communication';
import type { JoinOutcome, JoinTelemetry } from '@playhoot/feature-session-join';
import type { SessionPlayTelemetry } from '@playhoot/feature-session-play';
import type { GameHostError } from '@playhoot/game-host';
import {
  clientTelemetryLimits,
  type ClientTelemetryEvent,
  type TelemetryCloseKind,
  type TelemetryError,
} from '@playhoot/protocol';

// The one place where what the features report becomes the backend's telemetry catalog (plan §17),
// and where every error is classified by origin: presentation, bridge, transport, backend
// rejection, artifact/GameHost. Pure: the reporter sends what these return.

export function joinEvents(event: JoinTelemetry): ClientTelemetryEvent[] {
  switch (event.type) {
    case 'connection-closed':
      return [{ name: 'connection_lost', close: closeKinds[event.kind] ?? 'other' }];
    case 'reconnected':
      return [{ name: 'reconnect', outcome: 'reconnected' }];
    case 'gave-up':
      return [{ name: 'reconnect', outcome: 'gave_up' }];
    case 'resync-requested':
      return [{ name: 'resync' }];
    case 'outcome': {
      const error = outcomeError(event.outcome);
      return error ? [{ name: 'error', ...error }] : [];
    }
    case 'identity-failed':
      switch (event.error.kind) {
        case 'rate-limited':
          return [{ name: 'error', origin: 'backend_rejection', kind: 'rate_limited' }];
        case 'unavailable':
          return [{ name: 'error', origin: 'transport', kind: 'network' }];
        // A name the person typed wrong is not an error of the platform.
        case 'invalid-name':
          return [];
      }
  }
}

export function playEvents(event: SessionPlayTelemetry): ClientTelemetryEvent[] {
  switch (event.type) {
    case 'metric':
      return event.name === 'artifact-load-ms'
        ? [{ name: 'artifact_load', duration_ms: durationMs(event.valueMs), cached: event.cached }]
        : [{ name: 'game_ready', duration_ms: durationMs(event.valueMs) }];
    case 'bridge-rejected':
      return [{ name: 'bridge_refusal', reason: event.reason }];
    case 'game-failed':
      return [{ name: 'error', ...gameHostError(event.error) }];
  }
}

// A render that crashed into the route error boundary.
export function presentationError(): ClientTelemetryEvent {
  return { name: 'error', origin: 'presentation', kind: 'render_failed' };
}

const closeKinds: Record<ConnectionCloseKind, TelemetryCloseKind> = {
  unreachable: 'unreachable',
  'session-ended': 'session_ended',
  left: 'left',
  replaced: 'replaced',
  disconnected: 'disconnected',
  retryable: 'retryable',
  protocol: 'protocol',
  'game-data-invalid': 'other',
};

// Which outcomes of a join are errors, and of what origin. Ending, leaving and being replaced are
// not; a game stopped for misbehaving was already counted as its GameHost failure, and a game that
// sent undeclared data was recorded against the game by the backend before closing.
function outcomeError(outcome: JoinOutcome): TelemetryError | null {
  switch (outcome.kind) {
    case 'unreachable':
      return { origin: 'transport', kind: 'unreachable' };
    case 'connection-lost':
      return { origin: 'transport', kind: 'connection_lost' };
    case 'protocol-error':
      return { origin: 'transport', kind: 'protocol_error' };
    case 'rejected':
      return {
        origin: 'backend_rejection',
        kind: outcome.reason === 'unknown' ? 'rejected_unknown' : outcome.reason,
      };
    case 'ended':
    case 'left':
    case 'game-stopped':
    case 'game-error':
    case 'replaced':
      return null;
  }
}

function gameHostError(error: GameHostError): TelemetryError {
  switch (error.kind) {
    case 'artifact-unreachable':
      return { origin: 'artifact', kind: 'artifact_unreachable' };
    case 'artifact-hash-mismatch':
      return { origin: 'artifact', kind: 'artifact_hash_mismatch' };
    case 'ready-timeout':
      return { origin: 'artifact', kind: 'ready_timeout' };
    case 'unsupported-bridge-version':
      return { origin: 'artifact', kind: 'unsupported_bridge_version' };
    case 'container-violation':
      return { origin: 'bridge', kind: 'container_violation' };
    case 'bridge-abuse':
      return { origin: 'bridge', kind: 'bridge_abuse' };
  }
}

function durationMs(valueMs: number): number {
  return Math.min(Math.max(Math.round(valueMs), 0), clientTelemetryLimits.maxDurationMs);
}
