// POST /v1/client-telemetry (backend `api/clienttelemetry`): the client's operational telemetry,
// in batches, recorded by the backend as `client_*` metrics. A closed catalog: the backend drops
// any event or value outside it. Read as trends of what players experience, never trusted for
// decisions (a client can send anything here).
export const clientTelemetryPath = '/v1/client-telemetry';

export const clientTelemetryLimits = {
  maxEvents: 100,
  maxBodyBytes: 16 * 1024,
  maxDurationMs: 600_000,
  maxCount: 10_000,
} as const;

// How the client classified a closed live connection.
export type TelemetryCloseKind =
  | 'retryable'
  | 'unreachable'
  | 'protocol'
  | 'replaced'
  | 'left'
  | 'session_ended'
  | 'disconnected'
  | 'other';

// Every error is classified by where it came from (plan §17), with a kind from a closed list.
export const telemetryErrorKinds = {
  presentation: ['render_failed'],
  bridge: ['bridge_abuse', 'container_violation'],
  transport: ['unreachable', 'connection_lost', 'protocol_error', 'network'],
  backend_rejection: [
    'lobby_full',
    'session_started',
    'invalid_join_code',
    'join_code_expired',
    'session_unavailable',
    'participant_disconnected',
    'rejoin_rejected',
    'server_busy',
    'owner_changed',
    'not_creator',
    'too_many_admins',
    'rejected_unknown',
    'token_invalid',
    'rate_limited',
    'operation_forbidden',
    'http_error',
  ],
  artifact: [
    'artifact_unreachable',
    'artifact_hash_mismatch',
    'ready_timeout',
    'unsupported_bridge_version',
  ],
} as const;

export type TelemetryErrorOrigin = keyof typeof telemetryErrorKinds;
export type TelemetryError = {
  [Origin in TelemetryErrorOrigin]: {
    origin: Origin;
    kind: (typeof telemetryErrorKinds)[Origin][number];
  };
}[TelemetryErrorOrigin];

// One event of the catalog. Counted events carry `count` once the client coalesced them.
export type ClientTelemetryEvent =
  | { name: 'artifact_load'; duration_ms: number; cached: boolean }
  | { name: 'game_ready'; duration_ms: number }
  | { name: 'connection_lost'; close: TelemetryCloseKind; count?: number }
  | { name: 'reconnect'; outcome: 'reconnected' | 'gave_up'; count?: number }
  | { name: 'resync'; count?: number }
  | { name: 'bridge_refusal'; reason: 'invalid' | 'over_limit'; count?: number }
  | ({ name: 'error'; count?: number } & TelemetryError);

export interface ClientTelemetryBatch {
  events: ClientTelemetryEvent[];
}
