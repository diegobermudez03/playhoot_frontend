import type { HttpFailure } from '@playhoot/communication';
import {
  authErrorCodes,
  rateLimitedCode,
  secondFactorCodes,
  stepUpRequiredCode,
  taskNotFoundCode,
} from '@playhoot/protocol';

// Why something in the admin area did not happen. Presentation turns each kind into text; none of
// these ever carries a message the backend wrote (i18n rule).
export type AdminFailure =
  // The admin-mode token lapsed or was refused: sign in again and come back.
  | { kind: 'signed-out' }
  // The account has no admin grant.
  | { kind: 'not-admin' }
  // The code was wrong, already used, or belongs to another step.
  | { kind: 'invalid-code' }
  // Too many wrong codes: locked for a while (V-03).
  | { kind: 'locked'; retryAfterSeconds: number | undefined }
  // Too many requests of this kind just now.
  | { kind: 'rate-limited'; retryAfterSeconds: number | undefined }
  // No second factor is enrolled yet, or the pending enrollment lapsed (D-015).
  | { kind: 'not-enrolled' }
  | { kind: 'no-pending-enrollment' }
  // Replacing a confirmed credential needs a code from the authenticator in use.
  | { kind: 'current-code-required' }
  // The action was refused because its proof was not spent: ask for a fresh code (D-011).
  | { kind: 'step-up-required' }
  // The backend refused what was sent (a cap, a reason, a mode).
  | { kind: 'invalid' }
  // The task, or whatever the action named, is gone.
  | { kind: 'not-found' }
  // A conflict the caller must read as a state it did not expect; `code` is the backend's.
  | { kind: 'conflict'; code: string }
  // The backend could not be reached or failed.
  | { kind: 'unavailable' }
  | { kind: 'failed' };

// One reading of every HTTP failure the admin area can get, so no panel invents its own.
export function adminFailure(failure: HttpFailure): AdminFailure {
  if (failure.kind === 'network') return { kind: 'unavailable' };
  if (failure.kind === 'decode') return { kind: 'failed' };
  const { status, code, retryAfterSeconds } = failure;
  if (status >= 500) return { kind: 'unavailable' };
  if (
    status === 401 ||
    code === authErrorCodes.tokenInvalid ||
    code === authErrorCodes.tokenRequired ||
    code === authErrorCodes.tokenMalformed
  ) {
    return { kind: 'signed-out' };
  }
  switch (code) {
    case stepUpRequiredCode:
      return { kind: 'step-up-required' };
    case secondFactorCodes.notAdmin:
      return { kind: 'not-admin' };
    case secondFactorCodes.locked:
      return { kind: 'locked', retryAfterSeconds };
    case secondFactorCodes.notEnrolled:
      return { kind: 'not-enrolled' };
    case secondFactorCodes.noPendingEnrollment:
      return { kind: 'no-pending-enrollment' };
    case secondFactorCodes.currentCodeRequired:
      return { kind: 'current-code-required' };
    case secondFactorCodes.invalidCode:
      return { kind: 'invalid-code' };
    case rateLimitedCode:
      return { kind: 'rate-limited', retryAfterSeconds };
    case taskNotFoundCode:
      return { kind: 'not-found' };
    default:
      break;
  }
  if (status === 429) return { kind: 'rate-limited', retryAfterSeconds };
  if (status === 403) return { kind: 'not-admin' };
  if (status === 404) return { kind: 'not-found' };
  // A conflict this build does not know is still a conflict: the panel says what the backend
  // called it, as a kind, and refreshes.
  if (status === 409) return { kind: 'conflict', code: code ?? 'conflict' };
  if (status === 400) return { kind: 'invalid' };
  return { kind: 'failed' };
}

// Whether a failure means admin mode is over, whoever got it.
export function endsAdminMode(failure: AdminFailure): boolean {
  return failure.kind === 'signed-out';
}
