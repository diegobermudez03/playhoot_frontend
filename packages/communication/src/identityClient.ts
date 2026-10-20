import {
  createGuestPath,
  createGuestResponseSchema,
  type CreateGuestRequest,
} from '@playhoot/protocol';

import type { HttpClient, HttpFailure } from './http';
import type { Result } from './result';

export interface CreatedGuest {
  userUUID: string;
  token: string;
}

export interface IdentityClient {
  // Creates a guest identity. Reusing `idempotencyKey` when retrying returns the same guest.
  createGuest(
    displayName: string,
    idempotencyKey: string,
  ): Promise<Result<CreatedGuest, HttpFailure>>;
}

export function createIdentityClient(http: HttpClient): IdentityClient {
  return {
    async createGuest(displayName, idempotencyKey) {
      const body: CreateGuestRequest = {
        display_name: displayName,
        idempotency_key: idempotencyKey,
      };
      const result = await http.request({
        method: 'POST',
        path: createGuestPath,
        body,
        response: createGuestResponseSchema,
        authenticated: false,
      });
      if (!result.ok) return result;
      return { ok: true, value: { userUUID: result.value.user_uuid, token: result.value.token } };
    },
  };
}
