import { z } from 'zod';

// Body of every backend HTTP error (backend `api/internal/httpx/json.go`). `code` is the stable
// machine-readable reason when present; `message` is for humans.
export const errorBodySchema = z.object({
  code: z.string().optional(),
  message: z.string(),
});

export type ErrorBody = z.infer<typeof errorBodySchema>;

// Codes the backend auth middleware answers with (backend `api/internal/auth/auth.go`).
export const authErrorCodes = {
  tokenRequired: 'token_required',
  tokenMalformed: 'token_malformed',
  tokenInvalid: 'token_invalid',
  operationForbidden: 'operation_forbidden',
} as const;

export const rateLimitedCode = 'rate_limited';
