import { z } from 'zod';

// The caller's own data and the two settings only they decide (backend `api/me`, D-034, D-040):
// one composed read that says who they are, what they declared and what they may use, the mode
// their account is in, the language they read Playhoot in, and the end of their identity.

// GET /v1/me (Bearer, guest) → 200. Composed: the profile is Identity's, the declaration is
// Compliance's and the limits are the plan's, and either of the last two may be missing because
// its domain could not be asked — which is said, never guessed at.
export const myDataPath = '/v1/me';

// The modes an account can be in. The backend may name another; an unknown one reads as normal.
export const accountModes = ['normal', 'teacher'] as const;
export type AccountMode = (typeof accountModes)[number];

export function isAccountMode(value: string): value is AccountMode {
  return (accountModes as readonly string[]).includes(value);
}

// One way into the account, as the backend keeps it. `issuer` is the provider (`google`,
// `email`, `local`); `address` is empty for a provider that gave none.
export const signInMethodSchema = z.object({
  method_id: z.string().min(1),
  issuer: z.string().min(1),
  address: z.string().default(''),
  name: z.string().default(''),
  added_at: z.string().min(1),
});

export const myDataResponseSchema = z.object({
  profile: z.object({
    user_uuid: z.string().min(1),
    display_name: z.string().default(''),
    // `guest` or `account`; the backend may add values.
    level: z.string().min(1),
    mode: z.string().default('normal'),
    // Empty while the account has chosen no interface language.
    language: z.string().default(''),
    methods: z.array(signInMethodSchema).default([]),
  }),
  // False when Compliance could not be asked at all; `declaration` is null when there is none.
  declaration_known: z.boolean(),
  declaration: z
    .object({
      country: z.string().default(''),
      subdivision: z.string().default(''),
      meets_age: z.boolean(),
      threshold_age: z.number().int().nonnegative(),
      declared_at: z.string().min(1),
    })
    .nullish(),
  limits_known: z.boolean(),
  limits: z
    .object({
      saved_games: z.number().int().nonnegative(),
      creations_per_window: z.number().int().nonnegative(),
      sessions_per_window: z.number().int().nonnegative(),
      window_days: z.number().int().nonnegative(),
      players_per_session: z.number().int().nonnegative(),
      simultaneous_rooms: z.number().int().nonnegative(),
      storage_mb: z.number().int().nonnegative(),
    })
    .nullish(),
});

export type MyDataResponse = z.infer<typeof myDataResponseSchema>;
export type SignInMethodResponse = z.infer<typeof signInMethodSchema>;

// PUT /v1/identity/me/mode (Bearer, account) → 200 {mode, access_token, ...}: a fresh access
// token carrying the new mode; the refresh token the client holds is untouched (D-040).
// `400 invalid_mode`, `403 not_account` (guests are always normal).
export const setModePath = '/v1/identity/me/mode';

export interface SetModeRequest {
  mode: string;
}

export const setModeResponseSchema = z.object({
  mode: z.string().min(1),
  access_token: z.string().min(1),
  access_expires_at: z.string().min(1),
  access_expires_in: z.number().int().positive().optional(),
});

export const invalidModeCode = 'invalid_mode';
// A guest asked for a mode or an interface language: guests are always normal and keep their
// language in this browser alone.
export const notAnAccountCode = 'not_account';

// PUT /v1/identity/me/language (Bearer, account) → 200 {language}: the language the account
// reads Playhoot in, which its emails follow. `400 invalid_language`, `403 not_account`. The language is `es`, `en` or `pt`.
export const setLanguagePath = '/v1/identity/me/language';

export interface SetLanguageRequest {
  language: string;
}

export const setLanguageResponseSchema = z.object({ language: z.string().min(1) });

export const invalidLanguageCode = 'invalid_language';

// POST /v1/identity/me/delete (Bearer, guest) → 200 {deleted}: access ends as the answer is
// written; the erasure itself runs on the 30/90-day clock (P02§11, D-036). The credentials the
// client holds have already stopped working when this answers.
export const deleteIdentityPath = '/v1/identity/me/delete';

export const deleteIdentityResponseSchema = z.object({ deleted: z.boolean() });
