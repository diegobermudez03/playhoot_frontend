import {
  aiAuthorizationApprovePath,
  aiAuthorizationDecisionSchema,
  aiAuthorizationDenyPath,
  aiAuthorizationPath,
  aiAuthorizationSchema,
  aiConnectionRevokePath,
  aiConnectionsPath,
  aiConnectionsSchema,
  rateLimitedCode,
} from '@playhoot/protocol';

import type { Decoder, HttpClient, HttpFailure } from './http';
import { err, ok, type Result } from './result';

// An account's AI connections over MCP: the consent of an AI app's authorization request, and the
// list of connected apps with their revocation. Tokens are the backend's and the AI app's alone.

// What an AI app asks for, as the consent page shows it.
export interface AiAuthorizationRequest {
  clientName: string;
  clientUri: string | null;
  // The host the browser goes back to once the person decides.
  redirectHost: string;
  // What it asks to do (`games`; another value may come).
  scopes: string[];
  expiresAt: string;
}

export interface AiConnection {
  connectionID: string;
  clientName: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export type AiAccessFailure =
  // The request does not exist, expired or was already decided; or the connection is unknown.
  | { kind: 'not-found' }
  | { kind: 'busy'; retryAfterSeconds: number | undefined }
  // Anything else: no answer, a server failure, an unknown refusal or an unexpected body.
  | { kind: 'unavailable'; failure: HttpFailure };

export interface AiAccessClient {
  readAuthorization(requestID: string): Promise<Result<AiAuthorizationRequest, AiAccessFailure>>;
  // Each answers the URL the browser must go to next: the AI app's, with the decision.
  approveAuthorization(requestID: string): Promise<Result<string, AiAccessFailure>>;
  denyAuthorization(requestID: string): Promise<Result<string, AiAccessFailure>>;
  listConnections(): Promise<Result<AiConnection[], AiAccessFailure>>;
  revokeConnection(connectionID: string): Promise<Result<void, AiAccessFailure>>;
}

const noBody: Decoder<unknown> = { safeParse: (value) => ({ success: true, data: value }) };

export function createAiAccessClient(http: HttpClient): AiAccessClient {
  const decide = async (path: string): Promise<Result<string, AiAccessFailure>> => {
    const result = await http.request({
      method: 'POST',
      path,
      response: aiAuthorizationDecisionSchema,
    });
    if (!result.ok) return err(aiAccessFailure(result.error));
    return ok(result.value.redirect_url);
  };

  return {
    async readAuthorization(requestID) {
      const result = await http.request({
        method: 'GET',
        path: aiAuthorizationPath(requestID),
        response: aiAuthorizationSchema,
      });
      if (!result.ok) return err(aiAccessFailure(result.error));
      return ok({
        clientName: result.value.client_name,
        clientUri: result.value.client_uri ?? null,
        redirectHost: result.value.redirect_host,
        scopes: result.value.scopes,
        expiresAt: result.value.expires_at,
      });
    },

    approveAuthorization: (requestID) => decide(aiAuthorizationApprovePath(requestID)),
    denyAuthorization: (requestID) => decide(aiAuthorizationDenyPath(requestID)),

    async listConnections() {
      const result = await http.request({
        method: 'GET',
        path: aiConnectionsPath,
        response: aiConnectionsSchema,
      });
      if (!result.ok) return err(aiAccessFailure(result.error));
      return ok(
        result.value.map((connection) => ({
          connectionID: connection.connection_id,
          clientName: connection.client_name,
          createdAt: connection.created_at,
          lastUsedAt: connection.last_used_at ?? null,
        })),
      );
    },

    async revokeConnection(connectionID) {
      const result = await http.request({
        method: 'POST',
        path: aiConnectionRevokePath(connectionID),
        response: noBody,
      });
      if (!result.ok) return err(aiAccessFailure(result.error));
      return ok(undefined);
    },
  };
}

export function aiAccessFailure(failure: HttpFailure): AiAccessFailure {
  if (failure.kind !== 'http') return { kind: 'unavailable', failure };
  if (failure.status === 404) return { kind: 'not-found' };
  if (failure.code === rateLimitedCode || failure.status === 429 || failure.status === 503) {
    return { kind: 'busy', retryAfterSeconds: failure.retryAfterSeconds };
  }
  return { kind: 'unavailable', failure };
}
