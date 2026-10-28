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
