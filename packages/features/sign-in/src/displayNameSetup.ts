import type { AppState } from '@playhoot/app-core';
import type { IdentityClient } from '@playhoot/communication';
import { guestDisplayNameMaxLength, rateLimitedCode } from '@playhoot/protocol';
import { createStore, type StoreApi } from 'zustand/vanilla';

import type { IdentityError } from './guestSignIn';

export interface DisplayNameSetupState {
  submitting: boolean;
  error: IdentityError | null;
}

export interface DisplayNameSetupDeps {
  app: AppState;
  identity: IdentityClient;
}

export interface DisplayNameSetup {
  store: StoreApi<DisplayNameSetupState>;
  // Chooses the name other people see; true once it is kept.
  submit(displayName: string): Promise<boolean>;
}

// Choosing the name of an account that has none (an account starts without one). The new name
// shows at once; the access token is renewed so the backend sees it too (in a lobby, for example).
export function createDisplayNameSetup(deps: DisplayNameSetupDeps): DisplayNameSetup {
  const store = createStore<DisplayNameSetupState>(() => ({ submitting: false, error: null }));
  const fail = (error: IdentityError) => {
    store.setState({ submitting: false, error });
    return false;
  };

  return {
    store,
    async submit(raw) {
      const displayName = raw.trim();
      if (!displayName || [...displayName].length > guestDisplayNameMaxLength) {
        return fail({
          kind: 'invalid-name',
          reason: displayName ? 'too-long' : 'empty',
          maxLength: guestDisplayNameMaxLength,
        });
      }
      store.setState({ submitting: true, error: null });
      const result = await deps.identity.setDisplayName(displayName);
      if (!result.ok) {
        const failure = result.error;
        return fail(
          failure.kind === 'http' && failure.status === 400
            ? { kind: 'invalid-name', reason: 'rejected', maxLength: guestDisplayNameMaxLength }
            : failure.kind === 'http' && failure.code === rateLimitedCode
              ? { kind: 'rate-limited', retryAfterSeconds: failure.retryAfterSeconds }
              : { kind: 'unavailable' },
        );
      }
      deps.app.renamed(result.value || displayName);
      // Renewed in the background: if it cannot be now, the app keeps trying.
      void deps.app.credentials.refresh?.();
      store.setState({ submitting: false, error: null });
      return true;
    },
  };
}
