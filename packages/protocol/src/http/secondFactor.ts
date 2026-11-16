import { z } from 'zod';

// The administrator's second factor (backend `api/secondfactor/handler.go`, D-011, D-015). TOTP,
// RFC 6238: SHA-1, 6 digits, 30 seconds. These three endpoints are authorized at account level —
// only the account holding the active admin grant gets past them — and they are called with the
// ordinary account credential, never with the admin-mode token they issue.

export const totpEnrollPath = '/v1/identity/totp/enroll';
export const totpConfirmPath = '/v1/identity/totp/confirm';
export const totpVerifyPath = '/v1/identity/totp/verify';

// How many digits a code has, and which characters a code field accepts.
export const totpCodeLength = 6;
export const totpCodeAlphabet = '0123456789';

// Why a code or an enrollment was refused (backend `identity.SecondFactorOutcome`). The backend
// may answer a code this client does not know; that is still a refusal, worded generically.
export const secondFactorCodes = {
  notAdmin: 'not_admin',
  invalidCode: 'invalid_code',
  locked: 'locked',
  notEnrolled: 'not_enrolled',
  noPendingEnrollment: 'no_pending_enrollment',
  currentCodeRequired: 'current_code_required',
} as const;

// What a sensitive admin action is refused with when its proof was not accepted (D-011, D-017).
export const stepUpRequiredCode = 'step_up_required';

// POST /v1/identity/totp/enroll: starts an enrollment. `current_code` is required when a
// confirmed credential already exists (replacing it). The secret is shown once.
export interface TotpEnrollRequest {
  current_code?: string;
}

export const totpEnrollResponseSchema = z.object({
  // Base32, as authenticator apps expect it.
  secret: z.string().min(1),
  otpauth_uri: z.string().min(1),
  // When the pending enrollment lapses (10 minutes, D-015).
  expires_at: z.string().min(1),
});

// POST /v1/identity/totp/confirm: confirms the pending enrollment with its first code.
export interface TotpCodeRequest {
  code: string;
}

export const totpConfirmResponseSchema = z.object({ outcome: z.string() });

// POST /v1/identity/totp/verify: `admin_token` issues the 15-minute admin-mode access token;
// `step_up` issues a single-use proof for exactly one sensitive action (valid 10 minutes, V-03).
export const totpPurposes = { adminToken: 'admin_token', stepUp: 'step_up' } as const;
export type TotpPurpose = (typeof totpPurposes)[keyof typeof totpPurposes];

export interface TotpVerifyRequest {
  code: string;
  purpose: TotpPurpose;
}

export const adminTokenResponseSchema = z.object({
  purpose: z.string(),
  user_uuid: z.string().min(1),
  // `admin`; the backend may add levels.
  level: z.string().min(1),
  access_token: z.string().min(1),
  access_expires_at: z.string().min(1),
  // The token's lifetime in seconds, timed on this device's own clock.
  access_expires_in: z.number().int().positive(),
});

export const stepUpProofResponseSchema = z.object({
  purpose: z.string(),
  step_up_proof: z.string().min(1),
  expires_at: z.string().min(1),
});

export type AdminTokenResponse = z.infer<typeof adminTokenResponseSchema>;
export type StepUpProofResponse = z.infer<typeof stepUpProofResponseSchema>;
export type TotpEnrollResponse = z.infer<typeof totpEnrollResponseSchema>;
