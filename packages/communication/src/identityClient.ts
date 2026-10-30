import type { Credential } from '@playhoot/app-core';
import {
  createGuestPath,
  credentialsResponseSchema,
  displayNamePath,
  listOperationsPath,
  listOperationsResponseSchema,
  loginCompletePath,
  loginStartPath,
  loginStartResponseSchema,
  logoutPath,
  meResponseSchema,
  refreshPath,
  type CreateGuestRequest,
  type CredentialsResponse,
  type LoginCompleteRequest,
  type LoginStartRequest,
  type RefreshTokenRequest,
  type SetDisplayNameRequest,
} from '@playhoot/protocol';
import type { Decoder, HttpClient, HttpFailure } from './http';
import type { Result } from './result';

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
  ): Promise<Result<Credential, HttpFailure>>;
  // Renews credentials with a refresh token alone (no access token needed).
  refresh(refreshToken: string): Promise<Result<Credential, HttpFailure>>;
  // Ends the refresh token's session on the backend.
  logout(refreshToken: string): Promise<Result<void, HttpFailure>>;
  // Every operation with the minimum authentication level it requires. Needs no credential.
  listOperations(): Promise<Result<OperationRequirement[], HttpFailure>>;
  // Chooses the caller's display name; answers it as the backend kept it (trimmed).
  setDisplayName(displayName: string): Promise<Result<string, HttpFailure>>;
  // Starts an account sign-in with a provider; answers where to send the person.
  startLogin(provider: string, codeChallenge: string): Promise<Result<string, HttpFailure>>;
  // Exchanges the one-time code and the verifier for the account's credentials, ending the
  // session of `replacesRefreshToken` (the guest held until now) if given.
  completeLogin(
    code: string,
    codeVerifier: string,
    replacesRefreshToken?: string,
  ): Promise<Result<Credential, HttpFailure>>;
}

// `now` is the client's clock, which a received token's lifetime is measured on.
export function createIdentityClient(
  http: HttpClient,
  now: () => number = Date.now,
): IdentityClient {
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
        response: credentialsResponseSchema,
        authenticated: false,
      });
      return result.ok ? { ok: true, value: toCredential(result.value, now()) } : result;
    },
    async refresh(refreshToken) {
      const body: RefreshTokenRequest = { refresh_token: refreshToken };
      const result = await http.request({
        method: 'POST',
        path: refreshPath,
        body,
        response: credentialsResponseSchema,
        authenticated: false,
      });
      return result.ok ? { ok: true, value: toCredential(result.value, now()) } : result;
    },
    async logout(refreshToken) {
      const body: RefreshTokenRequest = { refresh_token: refreshToken };
      const result = await http.request({
        method: 'POST',
        path: logoutPath,
        body,
        response: noBody,
        authenticated: false,
      });
      return result.ok ? { ok: true, value: undefined } : result;
    },
    async setDisplayName(displayName) {
      const body: SetDisplayNameRequest = { display_name: displayName };
      const result = await http.request({
        method: 'PUT',
        path: displayNamePath,
        body,
        response: meResponseSchema,
      });
      return result.ok ? { ok: true, value: result.value.user.display_name } : result;
    },
    async startLogin(provider, codeChallenge) {
      const body: LoginStartRequest = { provider, code_challenge: codeChallenge };
      const result = await http.request({
        method: 'POST',
        path: loginStartPath,
        body,
        response: loginStartResponseSchema,
        authenticated: false,
      });
      return result.ok ? { ok: true, value: result.value.authorization_url } : result;
    },
    async completeLogin(code, codeVerifier, replacesRefreshToken) {
      const body: LoginCompleteRequest = {
        code,
        code_verifier: codeVerifier,
        ...(replacesRefreshToken && { replaces_refresh_token: replacesRefreshToken }),
      };
      const result = await http.request({
        method: 'POST',
        path: loginCompletePath,
        body,
        response: credentialsResponseSchema,
        authenticated: false,
      });
      return result.ok ? { ok: true, value: toCredential(result.value, now()) } : result;
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

// Logout answers 204 without a body.
const noBody: Decoder<unknown> = { safeParse: (value) => ({ success: true, data: value }) };

// The backend's credentials as the app keeps them. A level this client does not know counts as a
// guest, the weaker one: the backend still decides what it allows. The expiry is placed on this
// device's clock from the token's lifetime when the backend sends it, so a clock that is off does
// not renew too early or too late.
function toCredential(response: CredentialsResponse, receivedAt: number): Credential {
  const expiresAt =
    response.access_expires_in !== undefined
      ? receivedAt + response.access_expires_in * 1000
      : Date.parse(response.access_expires_at);
  return {
    token: response.access_token,
    refreshToken: response.refresh_token,
    ...(Number.isFinite(expiresAt) && { expiresAt }),
    userUUID: response.user.user_uuid,
    kind: response.user.level === 'account' ? 'account' : 'guest',
    ...(response.user.display_name && { displayName: response.user.display_name }),
  };
}
