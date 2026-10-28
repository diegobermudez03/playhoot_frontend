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
  // A join by code refused before reaching the Session (`api/play/join_code_routing.go`): the
  // code names no Session, or one that ended; or its lobby still runs but the code expired.
  'invalid_join_code',
  'join_code_expired',
  // The game version cannot be played on the device the player joined from (`requirements`).
  'device_not_supported',
  // A limit on joining: too many attempts (`retry_after_seconds`), too many open connections.
  'rate_limited',
  'too_many_connections',
  // Joining by Session UUID: no such Session, or one that already ended (`status`, `end_cause`).
  'invalid_session',
  'session_ended',
] as const;
export type RejectReason = (typeof rejectReasons)[number];

export const sessionStatuses = ['FINISHED', 'CANCELLED', 'EXPIRED', 'ABORTED'] as const;
export type SessionEndStatus = (typeof sessionStatuses)[number];

export const rejectedSchema = z.object({
  type: z.literal('rejected'),
  // Unknown future reasons still decode; the client treats them as generic.
  reason: z.string(),
  // With `device_not_supported`: what the game uses. Fields may be added or missing.
  requirements: z
    .object({
      devices: z.string(),
      uses_keyboard: z.boolean(),
      uses_pointer_hover: z.boolean(),
      uses_pointer_press: z.boolean(),
    })
    .partial()
    .optional(),
  // With `rate_limited`: how long to wait before trying again.
  retry_after_seconds: z.number().nonnegative().optional(),
  // With `session_ended`: how it ended, as in `session_ended` / `lobby_closed`.
  status: z.string().optional(),
  end_cause: z.string().optional(),
});

// Display names come from the backend's Identity; empty when it has none for someone.
const displayName = z.string().default('');

export const lobbyUpdateSchema = z.object({
  type: z.literal('lobby_update'),
  session_uuid: z.string().min(1),
  members: z.array(z.object({ user_uuid: z.string().min(1), display_name: displayName })),
  // How many players the game can start with (2026-10-27). Absent from an older backend.
  min_players: z.number().int().nonnegative().optional(),
  max_players: z.number().int().nonnegative().optional(),
});

export const participantSchema = z.object({
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

// A game asset (ADR-0008), signed in the same batch as the frontend: same expiry.
const frontendAssetSchema = z.object({
  key: z.string().min(1),
  type: z.string().min(1),
  mime_type: z.string().min(1),
  sha256: z.string().min(1),
  size: z.number().int().nonnegative(),
  url: z.string().min(1),
});

export const frontendSchema = z.object({
  url: z.string().min(1),
  sha256: z.string().min(1),
  expires_at: z.string().min(1),
  viewport: viewportSchema,
  // Absent from a backend older than game assets.
  assets: z.array(frontendAssetSchema).default([]),
});

const playerSessionStartedSchema = z.object({
  type: z.literal('session_started'),
  session_uuid: z.string().min(1),
  participant_id: z.string().min(1),
  participants: z.array(participantSchema),
  frontend: frontendSchema,
});

export const sessionEndSchema = z.object({
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
  // Any text: the backend may add outcomes; the ones not in `commandOutcomes` are handled as
  // unknown by the reader, never refused as a protocol error.
  outcome: z.string().min(1),
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
