import type { AppState } from '@playhoot/app-core';
import type { IdentityClient } from '@playhoot/communication';
import { guestDisplayNameMaxLength, rateLimitedCode } from '@playhoot/protocol';
import { createStore, type StoreApi } from 'zustand/vanilla';

// Why a name was not accepted. Presentation turns each into text in the person's language.
export type IdentityError =
  | { kind: 'invalid-name'; reason: 'empty' | 'too-long' | 'rejected'; maxLength: number }
  | { kind: 'rate-limited'; retryAfterSeconds: number | undefined }
  | { kind: 'unavailable' };

export interface GuestSignInState {
  submitting: boolean;
  error: IdentityError | null;
}

export type SignInTelemetry =
  // Creating the guest identity failed.
  { type: 'identity-failed'; error: IdentityError };

export interface GuestSignInDeps {
  app: AppState;
  identity: IdentityClient;
  newIdempotencyKey: () => string;
  onTelemetry?: (event: SignInTelemetry) => void;
}

export interface GuestSignIn {
  store: StoreApi<GuestSignInState>;
  // Creates a guest with this name and signs in as them; true once signed in. An answer that comes
  // after the person left the page still signs them in: the backend already created that guest.
  submit(displayName: string): Promise<boolean>;
}

// Playing as a guest: the person only gives a name. The guest lives in this browser for good; the
// backend keeps no way to recover it.
export function createGuestSignIn(deps: GuestSignInDeps): GuestSignIn {
  const store = createStore<GuestSignInState>(() => ({ submitting: false, error: null }));
  // One idempotency key per submitted name, reused when the same name is submitted again.
  let pending: { displayName: string; key: string } | null = null;

  const fail = (error: IdentityError) => store.setState({ submitting: false, error });

  return {
    store,
    async submit(raw) {
      const displayName = raw.trim();
      if (!displayName || [...displayName].length > guestDisplayNameMaxLength) {
        fail({
          kind: 'invalid-name',
          reason: displayName ? 'too-long' : 'empty',
          maxLength: guestDisplayNameMaxLength,
        });
        return false;
      }
      if (pending?.displayName !== displayName) {
        pending = { displayName, key: deps.newIdempotencyKey() };
      }
      store.setState({ submitting: true, error: null });
      const result = await deps.identity.createGuest(displayName, pending.key);
      if (result.ok) {
        pending = null;
        // Signed in with an account meanwhile (from the account option): a guest never replaces it.
        if (deps.app.store.getState().auth.status === 'authenticated') {
          store.setState({ submitting: false, error: null });
          return false;
        }
        // The backend's own form of the name, falling back to the one typed.
        deps.app.signIn({ ...result.value, displayName: result.value.displayName ?? displayName });
        store.setState({ submitting: false, error: null });
        return true;
      }
      const failure = result.error;
      // The backend no longer answers this key (too old to be a retry): the next attempt needs a
      // new one.
      if (failure.kind === 'http' && failure.status === 409) pending = null;
      const error: IdentityError =
        failure.kind === 'http' && failure.status === 400
          ? { kind: 'invalid-name', reason: 'rejected', maxLength: guestDisplayNameMaxLength }
          : failure.kind === 'http' && failure.code === rateLimitedCode
            ? { kind: 'rate-limited', retryAfterSeconds: failure.retryAfterSeconds }
            : { kind: 'unavailable' };
      deps.onTelemetry?.({ type: 'identity-failed', error });
      fail(error);
      return false;
    },
  };
}
