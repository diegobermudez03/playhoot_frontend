import { z } from 'zod';

// Server -> client messages of a PLAYER connection (backend `api/play/live_connection.go`,
// `api/play/player_join.go`).

export const rejectReasons = [
  'session_unavailable',
  'not_creator',
  'session_started',
  'lobby_full',
  'participant_disconnected',
  'rejoin_rejected',
  'owner_changed',
  'too_many_admins',
  'server_busy',
] as const;
export type RejectReason = (typeof rejectReasons)[number];

export const sessionStatuses = ['FINISHED', 'CANCELLED', 'EXPIRED', 'ABORTED'] as const;
export type SessionEndStatus = (typeof sessionStatuses)[number];

const rejectedSchema = z.object({
  type: z.literal('rejected'),
  // Unknown future reasons still decode; the client treats them as generic.
  reason: z.string(),
});

// Display names come from the backend's Identity; empty when it has none for someone.
const displayName = z.string().default('');

const lobbyUpdateSchema = z.object({
  type: z.literal('lobby_update'),
  session_uuid: z.string().min(1),
  members: z.array(z.object({ user_uuid: z.string().min(1), display_name: displayName })),
});

const participantSchema = z.object({
  participant_id: z.string().min(1),
  user_uuid: z.string().min(1),
  display_name: displayName,
});

export const presenceStatuses = ['active', 'reconnecting', 'disconnected', 'left'] as const;
export type PresenceStatus = (typeof presenceStatuses)[number];

// Every participant of the running game with whether they play, sent after `session_started` and
// whenever someone's presence changes. Unknown future statuses still decode.
const rosterUpdateSchema = z.object({
  type: z.literal('roster_update'),
  members: z.array(participantSchema.extend({ status: z.string() })),
});

// The GameVersion's fixed logical viewport: an aspect ratio from the backend's catalog and its
// logical resolution. The catalog is the backend's; the client only needs a usable size.
const viewportSchema = z.object({
  aspect_ratio: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

const frontendSchema = z.object({
  url: z.string().min(1),
  sha256: z.string().min(1),
  expires_at: z.string().min(1),
  viewport: viewportSchema,
});

const playerSessionStartedSchema = z.object({
  type: z.literal('session_started'),
  session_uuid: z.string().min(1),
  participant_id: z.string().min(1),
  participants: z.array(participantSchema),
  frontend: frontendSchema,
});

const sessionEndSchema = z.object({
  type: z.enum(['session_ended', 'lobby_closed']),
  status: z.string(),
  end_cause: z.string(),
});

// A view of the player's own state. FULL replaces the state and starts a new baseline; otherwise
// `state` is a patch (only changed fields, nested objects patched the same way, anything else sent
// whole). A view with the previous revision only carries a new ack and/or errors and events.
const playerViewSchema = z.object({
  type: z.literal('player_view'),
  participant_id: z.string().min(1),
  full: z.boolean(),
  revision: z.number().int().nonnegative(),
  state: z.unknown(),
  consumed_through_sample_sequence: z.number().int().nonnegative(),
  errors: z.array(z.unknown()).optional(),
  events: z.array(z.unknown()).optional(),
});

export const commandOutcomes = [
  'executed',
  'already_processed',
  'invalid',
  'session_not_running',
  'rate_limited',
] as const;
export type CommandOutcome = (typeof commandOutcomes)[number];

const commandResultSchema = z.object({
  type: z.literal('command_result'),
  token: z.string().min(1),
  outcome: z.enum(commandOutcomes),
  response: z.unknown().optional(),
});

const leaveResultSchema = z.object({
  type: z.literal('leave_result'),
  outcome: z.string(),
});

export const playerServerMessageSchema = z.discriminatedUnion('type', [
  rejectedSchema,
  lobbyUpdateSchema,
  playerSessionStartedSchema,
  sessionEndSchema,
  leaveResultSchema,
  playerViewSchema,
  commandResultSchema,
  rosterUpdateSchema,
]);

export type PlayerServerMessage = z.infer<typeof playerServerMessageSchema>;
export type PlayerSessionStartedMessage = z.infer<typeof playerSessionStartedSchema>;
export type PlayerViewMessage = z.infer<typeof playerViewSchema>;
export type CommandResultMessage = z.infer<typeof commandResultSchema>;
export type RosterUpdateMessage = z.infer<typeof rosterUpdateSchema>;

export const modeledPlayerServerMessageTypes: ReadonlySet<string> = new Set([
  'rejected',
  'lobby_update',
  'session_started',
  'session_ended',
  'lobby_closed',
  'leave_result',
  'player_view',
  'command_result',
  'roster_update',
]);
