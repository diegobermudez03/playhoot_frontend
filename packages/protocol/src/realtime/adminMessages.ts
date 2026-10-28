import { z } from 'zod';

import {
  frontendSchema,
  lobbyUpdateSchema,
  participantSchema,
  rejectedSchema,
  sessionEndSchema,
} from './serverMessages';

// Messages of the creator's ADMIN connection (backend `api/play/admin_join.go`). Admins and players
// are always separate connections, even for a creator who plays.

// Client -> server.
export type AdminClientMessage =
  | { type: 'start_session' }
  | { type: 'cancel_session' }
  | { type: 'select_perspective'; participant_id: string }
  | { type: 'resync' };

export const startSessionOutcomes = [
  'started',
  'already_started',
  'start_in_progress',
  'not_in_lobby',
  'invalid_player_count',
  'game_unavailable',
  'start_failed',
  'sandbox_unavailable',
] as const;
export type StartSessionOutcome = (typeof startSessionOutcomes)[number];

export const cancelSessionOutcomes = ['cancelled', 'already_ended'] as const;
export type CancelSessionOutcome = (typeof cancelSessionOutcomes)[number];

export const selectPerspectiveOutcomes = [
  'selected',
  'unknown_participant',
  'creator_is_playing',
  'session_not_running',
] as const;
export type SelectPerspectiveOutcome = (typeof selectPerspectiveOutcomes)[number];

// Like the player's, without the player's own participant.
const adminSessionStartedSchema = z.object({
  type: z.literal('session_started'),
  session_uuid: z.string().min(1),
  participants: z.array(participantSchema),
  frontend: frontendSchema,
});

// The view of the participant the admin watches: no ack and no errors (those are the player's).
const adminPlayerViewSchema = z.object({
  type: z.literal('player_view'),
  participant_id: z.string().min(1),
  full: z.boolean(),
  revision: z.number().int().nonnegative(),
  state: z.unknown(),
  events: z.array(z.unknown()).optional(),
});

// Answers to the admin's requests. Outcomes are any text: the backend may add some.
const resultSchema = <T extends string>(type: T) =>
  z.object({ type: z.literal(type), outcome: z.string().min(1) });

export const adminServerMessageSchema = z.discriminatedUnion('type', [
  rejectedSchema,
  lobbyUpdateSchema,
  adminSessionStartedSchema,
  sessionEndSchema,
  adminPlayerViewSchema,
  resultSchema('start_session_result'),
  resultSchema('cancel_session_result'),
  resultSchema('select_perspective_result'),
]);

export type AdminServerMessage = z.infer<typeof adminServerMessageSchema>;
export type AdminSessionStartedMessage = z.infer<typeof adminSessionStartedSchema>;
export type AdminPlayerViewMessage = z.infer<typeof adminPlayerViewSchema>;

export const modeledAdminServerMessageTypes: ReadonlySet<string> = new Set([
  'rejected',
  'lobby_update',
  'session_started',
  'session_ended',
  'lobby_closed',
  'player_view',
  'start_session_result',
  'cancel_session_result',
  'select_perspective_result',
]);
