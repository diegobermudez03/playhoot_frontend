// Client -> server messages of a PLAYER connection (backend `api/play/player_join.go`).

// A full snapshot of the player's logical inputs. Sequences start at 1 on every connection and
// only grow; gaps are fine because each sample carries everything.
export interface SampleMessage {
  type: 'sample';
  sequence: number;
  inputs: Record<string, unknown>;
}

// A discrete action. The token makes it idempotent for the participant: resending the same
// token never runs it twice.
export interface CommandMessage {
  type: 'command';
  token: string;
  name: string;
  payload?: Record<string, unknown> | null;
}

export interface ResyncMessage {
  type: 'resync';
}

export interface LeaveMessage {
  type: 'leave';
}

// How the client saw the game frontend fail or misbehave. The backend stores each report for
// auditing (one record per Session, player and kind, counted) and never answers it.
export const gameFaultKinds = [
  'artifact_unreachable',
  'artifact_hash_mismatch',
  'ready_timeout',
  'unsupported_bridge_version',
  'container_violation',
  'bridge_abuse',
] as const;
export type GameFaultKind = (typeof gameFaultKinds)[number];

// A fault of the running game, reported once when the client stops it. `detail` is evidence for
// whoever audits it (what happened, counts); the backend stores it without reading it.
export interface GameFaultMessage {
  type: 'game_fault';
  kind: GameFaultKind;
  detail: Record<string, unknown>;
}

export type PlayerClientMessage =
  SampleMessage | CommandMessage | ResyncMessage | LeaveMessage | GameFaultMessage;

// Server limits a client must respect (BACKEND_CONTRACT.md "Client limits").
export const realtimeLimits = {
  maxMessageBytes: 32 * 1024,
  maxCommandTokenLength: 128,
  samplesPerSecond: 60,
  // A bigger game_fault detail closes the connection as malformed.
  maxGameFaultDetailBytes: 2048,
} as const;
