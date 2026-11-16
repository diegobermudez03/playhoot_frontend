import {
  adminTokenResponseSchema,
  stepUpProofResponseSchema,
  totpConfirmPath,
  totpConfirmResponseSchema,
  totpEnrollPath,
  totpEnrollResponseSchema,
  totpPurposes,
  totpVerifyPath,
  type AdminTokenResponse,
  type StepUpProofResponse,
  type TotpCodeRequest,
  type TotpEnrollRequest,
  type TotpEnrollResponse,
  type TotpVerifyRequest,
} from '@playhoot/protocol';

import type { HttpClient, HttpFailure } from './http';
import type { Result } from './result';

// The administrator's TOTP credential and the two things a code buys: the admin-mode token, and a
// single-use proof for one sensitive action (D-011, D-015). Sent with the account credential.
export interface SecondFactorClient {
  // Starts an enrollment. `currentCode` is required when a confirmed credential already exists.
  enroll(currentCode?: string): Promise<Result<TotpEnrollResponse, HttpFailure>>;
  // Confirms the pending enrollment with its first code.
  confirm(code: string): Promise<Result<void, HttpFailure>>;
  // Exchanges a code for the 15-minute admin-mode access token.
  adminToken(code: string): Promise<Result<AdminTokenResponse, HttpFailure>>;
  // Exchanges a code for a single-use step-up proof, spent by exactly one action.
  stepUpProof(code: string): Promise<Result<StepUpProofResponse, HttpFailure>>;
}

export function createSecondFactorClient(http: HttpClient): SecondFactorClient {
  const verify = (code: string, purpose: TotpVerifyRequest['purpose']) => {
    const body: TotpVerifyRequest = { code, purpose };
    return { method: 'POST' as const, path: totpVerifyPath, body };
  };
  return {
    enroll(currentCode) {
      const body: TotpEnrollRequest = currentCode ? { current_code: currentCode } : {};
      return http.request({
        method: 'POST',
        path: totpEnrollPath,
        body,
        response: totpEnrollResponseSchema,
      });
    },
    async confirm(code) {
      const body: TotpCodeRequest = { code };
      const result = await http.request({
        method: 'POST',
        path: totpConfirmPath,
        body,
        response: totpConfirmResponseSchema,
      });
      return result.ok ? { ok: true, value: undefined } : result;
    },
    adminToken(code) {
      return http.request({
        ...verify(code, totpPurposes.adminToken),
        response: adminTokenResponseSchema,
      });
    },
    stepUpProof(code) {
      return http.request({
        ...verify(code, totpPurposes.stepUp),
        response: stepUpProofResponseSchema,
      });
    },
  };
}
