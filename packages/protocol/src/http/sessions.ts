import { z } from 'zod';

// POST /v1/sessions (backend `api/play/create_session.go`): an account creates a Session of a game.
// `404` when the game is not playable; `409` when the idempotency key was used for another request.
export const createSessionPath = '/v1/sessions';

export interface CreateSessionRequest {
  game_uuid: string;
  idempotency_key: string;
}

export const createSessionResponseSchema = z.object({
  session_uuid: z.string().min(1),
  join_code: z.string().min(1),
  lobby_expires_at: z.string().min(1),
});

export type CreateSessionResponse = z.infer<typeof createSessionResponseSchema>;
