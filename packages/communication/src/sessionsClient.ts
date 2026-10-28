import {
  createSessionPath,
  createSessionResponseSchema,
  type CreateSessionRequest,
} from '@playhoot/protocol';

import type { HttpClient, HttpFailure } from './http';
import type { Result } from './result';

export interface CreatedSession {
  sessionUUID: string;
  joinCode: string;
  lobbyExpiresAt: string;
}

export interface SessionsClient {
  // Creates a Session of a game as the signed-in account. Reusing `idempotencyKey` when retrying
  // returns the same Session.
  createSession(
    gameUUID: string,
    idempotencyKey: string,
  ): Promise<Result<CreatedSession, HttpFailure>>;
}

export function createSessionsClient(http: HttpClient): SessionsClient {
  return {
    async createSession(gameUUID, idempotencyKey) {
      const body: CreateSessionRequest = { game_uuid: gameUUID, idempotency_key: idempotencyKey };
      const result = await http.request({
        method: 'POST',
        path: createSessionPath,
        body,
        response: createSessionResponseSchema,
      });
      if (!result.ok) return result;
      return {
        ok: true,
        value: {
          sessionUUID: result.value.session_uuid,
          joinCode: result.value.join_code,
          lobbyExpiresAt: result.value.lobby_expires_at,
        },
      };
    },
  };
}
