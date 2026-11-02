import { z } from 'zod';

import {
  commandResultSchema,
  frontendSchema,
  playerViewSchema,
  rejectedSchema,
} from './serverMessages';

// Messages of a PREVIEW connection (backend `api/play`, previews): the creator plays a private test
// game of their draft's build as each synthetic participant in turn. Views are those of the
// participant acted as, with the player connection's patches and acks.

export function previewConnectPath(previewUUID: string): string {
  return `/v1/play/previews/${encodeURIComponent(previewUUID)}/connect`;
}

// Client -> server. After `act_as` the views are the new participant's (a FULL one first) and
// sample sequences start again at 1.
export type PreviewClientMessage =
  | { type: 'act_as'; participant_id: string }
  | { type: 'sample'; sequence: number; inputs: Record<string, unknown> }
  | { type: 'command'; token: string; name: string; payload?: Record<string, unknown> | null }
  | { type: 'resync' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'end' };

// Why a preview ended. Unknown future reasons still decode.
export const previewEndReasons = [
  'finished',
  'idle',
  'ended_by_owner',
  'replaced',
  'script_failure',
  'unavailable',
] as const;
export type PreviewEndReason = (typeof previewEndReasons)[number];

const previewStartedSchema = z.object({
  type: z.literal('preview_started'),
  preview_uuid: z.string().min(1),
  revision: z.number().int(),
  participants: z.array(z.string().min(1)),
  acting_as: z.string().min(1),
  paused: z.boolean(),
  frontend: frontendSchema,
});

const actingAsSchema = z.object({
  type: z.literal('acting_as'),
  participant_id: z.string().min(1),
});

// Codes of a preview `error`: the connection stays open. `invalid_game_data` is a SAMPLE or
// COMMAND the game does not declare (its `token` names the command); `unknown_participant`
// answers an `act_as` the preview does not have. Unknown future codes still decode.
export const previewErrorCodes = ['invalid_game_data', 'unknown_participant'] as const;
export type PreviewErrorCode = (typeof previewErrorCodes)[number];

const previewErrorSchema = z.object({
  type: z.literal('error'),
  code: z.string().min(1),
  detail: z.string().optional(),
  token: z.string().optional(),
});

const previewEndedSchema = z.object({
  type: z.literal('preview_ended'),
  reason: z.string(),
});

export const previewServerMessageSchema = z.discriminatedUnion('type', [
  previewStartedSchema,
  playerViewSchema,
  actingAsSchema,
  z.object({ type: z.literal('paused') }),
  z.object({ type: z.literal('resumed') }),
  commandResultSchema,
  previewEndedSchema,
  previewErrorSchema,
  rejectedSchema,
]);

export type PreviewServerMessage = z.infer<typeof previewServerMessageSchema>;
export type PreviewStartedMessage = z.infer<typeof previewStartedSchema>;
export type PreviewErrorMessage = z.infer<typeof previewErrorSchema>;

export const modeledPreviewServerMessageTypes: ReadonlySet<string> = new Set([
  'preview_started',
  'player_view',
  'acting_as',
  'paused',
  'resumed',
  'command_result',
  'preview_ended',
  'error',
  'rejected',
]);
