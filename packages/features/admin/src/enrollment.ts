import type { SecondFactorClient } from '@playhoot/communication';
import { createStore, type StoreApi } from 'zustand/vanilla';

import { adminFailure, type AdminFailure } from './failures';

// What a started enrollment shows, once and only once.
export interface PendingEnrollment {
  // Base32, to type into an authenticator by hand.
  secret: string;
  // The same credential as an address, which the QR encodes.
  otpauthUri: string;
  // When the pending enrollment lapses (10 minutes, D-015).
  expiresAt: string;
}

export interface EnrollmentState {
  // `idle`: nothing started. `pending`: the secret is on screen and waits for its first code.
  // `confirmed`: the credential is in use.
  step: 'idle' | 'pending' | 'confirmed';
  pending: PendingEnrollment | null;
  busy: boolean;
  error: AdminFailure | null;
}

export interface Enrollment {
  store: StoreApi<EnrollmentState>;
  // Starts an enrollment. `currentCode` is what the authenticator in use shows, required only
  // when a confirmed credential is being replaced.
  start(currentCode?: string): Promise<boolean>;
  // Confirms the pending enrollment with its first code.
  confirm(code: string): Promise<boolean>;
  // Throws the shown secret away without confirming it (leaving the screen).
  discard(): void;
}

// Enrolling or replacing the administrator's TOTP credential (D-015). A confirmed credential and
// a pending one may exist at once, so replacing never leaves the administrator without a factor.
export function createEnrollment(deps: { secondFactor: SecondFactorClient }): Enrollment {
  const store = createStore<EnrollmentState>(() => ({
    step: 'idle',
    pending: null,
    busy: false,
    error: null,
  }));
  return {
    store,
    async start(currentCode) {
      if (store.getState().busy) return false;
      store.setState({ busy: true, error: null });
      const result = await deps.secondFactor.enroll(currentCode);
      if (!result.ok) {
        store.setState({ busy: false, error: adminFailure(result.error) });
        return false;
      }
      store.setState({
        busy: false,
        error: null,
        step: 'pending',
        pending: {
          secret: result.value.secret,
          otpauthUri: result.value.otpauth_uri,
          expiresAt: result.value.expires_at,
        },
      });
      return true;
    },
    async confirm(code) {
      if (store.getState().busy) return false;
      store.setState({ busy: true, error: null });
      const result = await deps.secondFactor.confirm(code);
      if (!result.ok) {
        const error = adminFailure(result.error);
        // A lapsed pending enrollment cannot be confirmed: the secret on screen is worthless and
        // is taken away, so nobody types codes from an authenticator that will never be accepted.
        const lapsed = error.kind === 'no-pending-enrollment';
        store.setState({
          busy: false,
          error,
          ...(lapsed && { step: 'idle' as const, pending: null }),
        });
        return false;
      }
      store.setState({ busy: false, error: null, step: 'confirmed', pending: null });
      return true;
    },
    discard() {
      store.setState({ step: 'idle', pending: null, busy: false, error: null });
    },
  };
}
