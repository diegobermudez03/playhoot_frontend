import { z } from 'zod';

// Credentials of a session (backend `api/identity/credentials.go`, IDENTITY-ADR-0003): a short
// access token sent with every request, and the refresh token that renews it, which the client
// keeps. Returned by guest creation and by refreshing.
export const credentialsResponseSchema = z.object({
  user: z.object({
    user_uuid: z.string().min(1),
    display_name: z.string().default(''),
    // `guest` or `account`; the backend may add values.
    level: z.string().min(1),
  }),
  access_token: z.string().min(1),
  access_expires_at: z.string().min(1),
  // The access token's lifetime in seconds: timed on the client's own clock, unlike the instant.
  access_expires_in: z.number().int().positive().optional(),
  refresh_token: z.string().min(1),
});

export type CredentialsResponse = z.infer<typeof credentialsResponseSchema>;

// POST /v1/guests (backend `api/identity/create_guest.go`): a guest for a name, idempotently per
// key. `400 invalid_display_name`, `409 idempotency_conflict` (same key, another name), `409
// idempotency_key_spent` (the key's guest is too old or signed out: start a new attempt).
export const createGuestPath = '/v1/guests';

export const guestDisplayNameMaxLength = 64;

export interface CreateGuestRequest {
  display_name: string;
  idempotency_key: string;
}

// POST /v1/identity/refresh: renews with the refresh token alone. `401 refresh_invalid` when the
// token is no longer valid (sign in again).
export const refreshPath = '/v1/identity/refresh';
export const refreshInvalidCode = 'refresh_invalid';

// POST /v1/identity/logout: ends the refresh token's session. `204` whether or not it was active.
export const logoutPath = '/v1/identity/logout';

export interface RefreshTokenRequest {
  refresh_token: string;
}

// Account sign-in (backend IDENTITY-ADR-0003 point 8): the client keeps a random verifier and sends
// only its S256 hash; the provider's callback sends the browser to the client's completion route
// with a one-time code, which the client exchanges with the verifier for the credentials.

// POST /v1/identity/login/start → 200 {authorization_url}: navigate the page there. `400
// provider_unavailable` (not enabled here), `400 invalid_code_challenge`.
export const loginStartPath = '/v1/identity/login/start';
export const providerUnavailableCode = 'provider_unavailable';

export interface LoginStartRequest {
  provider: string;
  code_challenge: string;
}

export const loginStartResponseSchema = z.object({ authorization_url: z.string().min(1) });

// POST /v1/identity/login/complete → 200 credentials (level `account`). A given
// `replaces_refresh_token` (the guest held until now) has its session ended. `400
// login_code_invalid`: unknown, used, expired or another verifier; start again.
export const loginCompletePath = '/v1/identity/login/complete';
export const loginCodeInvalidCode = 'login_code_invalid';

export interface LoginCompleteRequest {
  code: string;
  code_verifier: string;
  replaces_refresh_token?: string;
}

// Why the completion route was reached without a code (`?error=`).
export const loginCompletionErrors = ['cancelled', 'failed', 'unavailable'] as const;
export type LoginCompletionError = (typeof loginCompletionErrors)[number];

// PUT /v1/identity/me/display-name (Bearer, SET_OWN_DISPLAY_NAME) → 200 {user}. An account has no
// display name until its person chooses one (`user.display_name` is ""). The access token keeps the
// old name until renewed: renew right after. `400 invalid_display_name`.
export const displayNamePath = '/v1/identity/me/display-name';

export interface SetDisplayNameRequest {
  display_name: string;
}

export const meResponseSchema = z.object({
  user: z.object({
    user_uuid: z.string().min(1),
    display_name: z.string().default(''),
    level: z.string().min(1),
  }),
});
