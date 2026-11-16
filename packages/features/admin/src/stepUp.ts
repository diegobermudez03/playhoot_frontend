import type { HttpFailure, Result, SecondFactorClient } from '@playhoot/communication';

import { adminFailure, type AdminFailure } from './failures';

// One sensitive action, with the fresh code it was confirmed with (D-011): the code buys a
// single-use proof, the proof is spent by exactly one call, and a refused proof comes back as
// `step-up-required` so the screen asks for another code. The proof never leaves this call.
export async function withStepUp<T>(
  secondFactor: SecondFactorClient,
  code: string,
  action: (proof: string) => Promise<Result<T, HttpFailure>>,
): Promise<Result<T, AdminFailure>> {
  const proof = await secondFactor.stepUpProof(code);
  if (!proof.ok) return { ok: false, error: adminFailure(proof.error) };
  const result = await action(proof.value.step_up_proof);
  return result.ok ? result : { ok: false, error: adminFailure(result.error) };
}
