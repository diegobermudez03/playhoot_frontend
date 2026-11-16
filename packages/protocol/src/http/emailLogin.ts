import { z } from 'zod';

// Signing in with a one-time code sent by email (backend `api/identity/email_login.go`,
// D-033): type the address, receive a 6-digit code, type it to enter or to finish registering.
// The attempt lives on the backend — the client keeps nothing but the address it typed.

// How many digits the emailed code has, and what it is made of (V-09).
export const emailCodeLength = 6;
export const emailCodeAlphabet = '0123456789';

// POST /v1/identity/login/email/start → 200 {}: the same acknowledgement for every address,
// whether or not it has an account and whether or not a code was really sent, so nothing can be
// learned from it. Sent with the access token in use: a guest's becomes the account if completing
// the code creates one (P03§10). `400 invalid_address` is the only refusal that says anything,
// and it says only that the value is not an address. `429 rate_limited` when asked too often.
export const emailLoginStartPath = '/v1/identity/login/email/start';
export const invalidAddressCode = 'invalid_address';

export interface EmailLoginStartRequest {
  email: string;
  // The language the code's email is written in; the backend falls back to the browser's.
  language: string;
}

// POST /v1/identity/login/email/complete → 200 credentials. `400 invalid_code`: that is not the
// code sent to this address (the attempt is still live, so another try is possible).
// `410 attempt_gone`: expired, superseded by a newer code, or spent on five wrong tries — ask
// for a new code (V-09).
export const emailLoginCompletePath = '/v1/identity/login/email/complete';
export const invalidCodeCode = 'invalid_code';
export const attemptGoneCode = 'attempt_gone';

export interface EmailLoginCompleteRequest {
  email: string;
  code: string;
  // The guest held until now, whose session ends as the account takes over.
  replaces_refresh_token?: string;
}

// Linking another way into an account already signed in (backend `api/identity/methods.go`).
// Only the provider round trip is used here: the completion route finishes it when the trip it
// came back from was a link and not a sign-in. The rest of the methods screen is its own screen.
export const linkProviderStartPath = '/v1/identity/me/methods/provider/start';
export const linkProviderCompletePath = '/v1/identity/me/methods/provider/complete';

// `409 method_in_use`: that identity is another account's way in, and matching addresses never
// merge accounts (P03§11).
export const methodInUseCode = 'method_in_use';

export interface LinkProviderStartRequest {
  provider: string;
  code_challenge: string;
}

export interface LinkProviderCompleteRequest {
  code: string;
  code_verifier: string;
}

export const linkProviderStartResponseSchema = z.object({
  authorization_url: z.string().min(1),
});
