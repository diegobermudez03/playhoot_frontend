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

export type PlayerClientMessage = SampleMessage | CommandMessage | ResyncMessage | LeaveMessage;

// Server limits a client must respect (BACKEND_CONTRACT.md "Client limits").
export const realtimeLimits = {
  maxMessageBytes: 32 * 1024,
  maxCommandTokenLength: 128,
  samplesPerSecond: 60,
} as const;
