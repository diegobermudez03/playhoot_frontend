import type { Credential } from '@playhoot/app-core';
import {
  createGuestPath,
  credentialsResponseSchema,
  displayNamePath,
  emailLoginCompletePath,
  emailLoginStartPath,
  linkProviderCompletePath,
  linkProviderStartPath,
  linkEmailCompletePath,
  linkEmailStartPath,
  linkProviderStartResponseSchema,
  listOperationsPath,
  listOperationsResponseSchema,
  loginCompletePath,
  loginProvidersPath,
  loginProvidersResponseSchema,
  loginStartPath,
  loginStartResponseSchema,
  logoutPath,
  meResponseSchema,
  refreshPath,
  removeSignInMethodPath,
  signInMethodsPath,
  signInMethodsResponseSchema,
  type CreateGuestRequest,
  type CredentialsResponse,
  type EmailLoginCompleteRequest,
  type EmailLoginStartRequest,
  type LinkEmailRequest,
  type LinkProviderCompleteRequest,
  type LinkProviderStartRequest,
  type LoginCompleteRequest,
  type LoginStartRequest,
  type RefreshTokenRequest,
  type SetDisplayNameRequest,
} from '@playhoot/protocol';
import type { Decoder, HttpClient, HttpFailure } from './http';
import { toSignInMethod, type SignInMethod } from './meClient';
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
  // The login providers this backend offers (`google`, `local`...). Needs no credential.
  listLoginProviders(): Promise<Result<string[], HttpFailure>>;
  // Starts an account sign-in with a provider; answers where to send the person. Sent with the
  // access token in use: a guest's becomes the account if the sign-in creates one.
  startLogin(provider: string, codeChallenge: string): Promise<Result<string, HttpFailure>>;
  // Exchanges the one-time code and the verifier for the account's credentials, ending the
  // session of `replacesRefreshToken` (the guest held until now) if given.
  completeLogin(
    code: string,
    codeVerifier: string,
    replacesRefreshToken?: string,
  ): Promise<Result<Credential, HttpFailure>>;
  // Asks for a one-time code to be sent to an address. The answer is the same for every address,
  // so nothing it says tells whether that address has an account. Sent with the access token in
  // use: a guest's becomes the account if completing the code creates one.
  startEmailLogin(email: string, language: string): Promise<Result<void, HttpFailure>>;
  // Exchanges an address and the code emailed to it for the account's credentials, ending the
  // session of `replacesRefreshToken` (the guest held until now) if given.
  completeEmailLogin(
    email: string,
    code: string,
    replacesRefreshToken?: string,
  ): Promise<Result<Credential, HttpFailure>>;
  // Starts linking another provider to the account already signed in; answers where to send the
  // person, exactly as signing in does.
  startLinkProvider(provider: string, codeChallenge: string): Promise<Result<string, HttpFailure>>;
  // Finishes that round trip. It opens no session: the account was already signed in.
  completeLinkProvider(code: string, codeVerifier: string): Promise<Result<void, HttpFailure>>;
  // The ways into the account already signed in, each with when it was added.
  listSignInMethods(): Promise<Result<SignInMethod[], HttpFailure>>;
  // Asks for a code to be sent to an address the account is adding. The acknowledgement is the
  // same whatever the address, exactly as signing in by email.
  startLinkEmail(email: string, language: string): Promise<Result<void, HttpFailure>>;
  // Verifies that code and adds the address as another way in.
  completeLinkEmail(email: string, code: string): Promise<Result<void, HttpFailure>>;
  // Unlinks one way in. The backend refuses the last one (`last_method`): an account must stay
  // reachable (P03§12).
  removeSignInMethod(methodID: string): Promise<Result<void, HttpFailure>>;
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
    async listLoginProviders() {
      const result = await http.request({
        method: 'GET',
        path: loginProvidersPath,
        response: loginProvidersResponseSchema,
        authenticated: false,
      });
      return result.ok ? { ok: true, value: result.value.providers } : result;
    },
    async startLogin(provider, codeChallenge) {
      const body: LoginStartRequest = { provider, code_challenge: codeChallenge };
      const result = await http.request({
        method: 'POST',
        path: loginStartPath,
        body,
        response: loginStartResponseSchema,
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
    async startEmailLogin(email, language) {
      const body: EmailLoginStartRequest = { email, language };
      const result = await http.request({
        method: 'POST',
        path: emailLoginStartPath,
        body,
        response: anyBody,
      });
      return result.ok ? { ok: true, value: undefined } : result;
    },
    async completeEmailLogin(email, code, replacesRefreshToken) {
      const body: EmailLoginCompleteRequest = {
        email,
        code,
        ...(replacesRefreshToken && { replaces_refresh_token: replacesRefreshToken }),
      };
      const result = await http.request({
        method: 'POST',
        path: emailLoginCompletePath,
        body,
        response: credentialsResponseSchema,
        authenticated: false,
      });
      return result.ok ? { ok: true, value: toCredential(result.value, now()) } : result;
    },
    async startLinkProvider(provider, codeChallenge) {
      const body: LinkProviderStartRequest = { provider, code_challenge: codeChallenge };
      const result = await http.request({
        method: 'POST',
        path: linkProviderStartPath,
        body,
        response: linkProviderStartResponseSchema,
      });
      return result.ok ? { ok: true, value: result.value.authorization_url } : result;
    },
    async completeLinkProvider(code, codeVerifier) {
      const body: LinkProviderCompleteRequest = { code, code_verifier: codeVerifier };
      const result = await http.request({
        method: 'POST',
        path: linkProviderCompletePath,
        body,
        response: anyBody,
      });
      return result.ok ? { ok: true, value: undefined } : result;
    },
    async listSignInMethods() {
      const result = await http.request({
        method: 'GET',
        path: signInMethodsPath,
        response: signInMethodsResponseSchema,
      });
      return result.ok
        ? { ok: true as const, value: result.value.methods.map(toSignInMethod) }
        : result;
    },
    async startLinkEmail(email, language) {
      const body: LinkEmailRequest = { email, language };
      const result = await http.request({
        method: 'POST',
        path: linkEmailStartPath,
        body,
        response: anyBody,
      });
      return result.ok ? { ok: true as const, value: undefined } : result;
    },
    async completeLinkEmail(email, code) {
      const body: LinkEmailRequest = { email, code };
      const result = await http.request({
        method: 'POST',
        path: linkEmailCompletePath,
        body,
        response: anyBody,
      });
      return result.ok ? { ok: true as const, value: undefined } : result;
    },
    async removeSignInMethod(methodID) {
      const result = await http.request({
        method: 'POST',
        path: removeSignInMethodPath(methodID),
        response: anyBody,
      });
      return result.ok ? { ok: true as const, value: undefined } : result;
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

// Logout answers 204 without a body; the acknowledgements answer `{}`. Neither carries anything
// to read.
const noBody: Decoder<unknown> = { safeParse: (value) => ({ success: true, data: value }) };
const anyBody = noBody;

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
    ...(response.user.mode && { mode: response.user.mode }),
  };
}
