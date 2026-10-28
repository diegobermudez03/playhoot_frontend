import {
  createGuestPath,
  createGuestResponseSchema,
  listOperationsPath,
  listOperationsResponseSchema,
  type CreateGuestRequest,
} from '@playhoot/protocol';

import type { HttpClient, HttpFailure } from './http';
import type { Result } from './result';

export interface CreatedGuest {
  userUUID: string;
  token: string;
}

// One operation of the backend's catalog, with the level it requires as the backend wrote it
// (possibly a level this client does not know).
export interface OperationRequirement {
  operation: string;
  requiredLevel: string;
}

export interface IdentityClient {
  // Creates a guest identity. Reusing `idempotencyKey` when retrying returns the same guest.
  createGuest(
    displayName: string,
    idempotencyKey: string,
  ): Promise<Result<CreatedGuest, HttpFailure>>;
  // Every operation with the minimum authentication level it requires. Needs no credential.
  listOperations(): Promise<Result<OperationRequirement[], HttpFailure>>;
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
    async listOperations() {
      const result = await http.request({
        method: 'GET',
        path: listOperationsPath,
        response: listOperationsResponseSchema,
        authenticated: false,
      });
      if (!result.ok) return result;
      return {
        ok: true,
        value: result.value.operations.map((entry) => ({
          operation: entry.operation,
          requiredLevel: entry.required_level,
        })),
      };
    },
  };
}
