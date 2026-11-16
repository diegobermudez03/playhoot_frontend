import type { SecondFactorClient } from '@playhoot/communication';
import { createStore, type StoreApi } from 'zustand/vanilla';

import type { AdminSession } from './adminSession';
import { adminFailure, type AdminFailure } from './failures';

export interface AdminSignInState {
  submitting: boolean;
  error: AdminFailure | null;
}

export interface AdminSignIn {
  store: StoreApi<AdminSignInState>;
  // Exchanges the code for the admin-mode token and holds it. True when admin mode is open.
  submit(code: string): Promise<boolean>;
}

export interface AdminSignInDeps {
  secondFactor: SecondFactorClient;
  session: AdminSession;
}

// The second half of the admin sign-in: the account is already signed in, and one TOTP code buys
// the 15-minute admin-mode token (D-015). The account sign-in itself is the public screen's.
export function createAdminSignIn(deps: AdminSignInDeps): AdminSignIn {
  const store = createStore<AdminSignInState>(() => ({ submitting: false, error: null }));
  return {
    store,
    async submit(code) {
      if (store.getState().submitting) return false;
      store.setState({ submitting: true, error: null });
      const result = await deps.secondFactor.adminToken(code);
      if (!result.ok) {
        store.setState({ submitting: false, error: adminFailure(result.error) });
        return false;
      }
      deps.session.hold(result.value);
      store.setState({ submitting: false, error: null });
      return true;
    },
  };
}
