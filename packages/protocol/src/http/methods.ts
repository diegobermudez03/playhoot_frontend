import { z } from 'zod';
import { signInMethodSchema } from './me';

// The ways into an account (backend `api/identity/methods.go`, P03§11-12, D-035). A method is
// added by proving control of both sides; a matching address never merges two accounts; the last
// one cannot be removed, because signing in through a linked method is how an account is
// recovered. The provider round trip itself lives in `emailLogin.ts`: it is the sign-in
// machinery, and the completion route finishes both.

// GET /v1/identity/me/methods (Bearer, account) → 200 {methods}.
export const signInMethodsPath = '/v1/identity/me/methods';

export const signInMethodsResponseSchema = z.object({
  methods: z.array(signInMethodSchema).default([]),
});

// POST /v1/identity/me/methods/email/start → 200 {}: the same acknowledgement whatever the
// address, as signing in by email gives (V-09, D-033). `429 rate_limited` when asked too often.
export const linkEmailStartPath = '/v1/identity/me/methods/email/start';

// POST /v1/identity/me/methods/email/complete → 200 {} once the address is linked.
// `400 invalid_code`, `410 attempt_gone`, `409 method_in_use`.
export const linkEmailCompletePath = '/v1/identity/me/methods/email/complete';

export interface LinkEmailRequest {
  email: string;
  // The language the code's email is written in (start only).
  language?: string;
  // The six digits (complete only).
  code?: string;
}

// POST /v1/identity/me/methods/{methodID}/remove → 200 {}. `409 last_method` when it is the only
// way in left, `404 no_such_method` when this account has no such method.
export const removeSignInMethodPath = (methodID: string) =>
  `${signInMethodsPath}/${encodeURIComponent(methodID)}/remove`;

export const lastMethodCode = 'last_method';
export const noSuchMethodCode = 'no_such_method';

// The issuers this build names. The backend may answer another, which is still shown as a way in.
export const signInIssuers = ['google', 'email', 'local'] as const;
export type SignInIssuer = (typeof signInIssuers)[number];

export function isSignInIssuer(value: string): value is SignInIssuer {
  return (signInIssuers as readonly string[]).includes(value);
}
