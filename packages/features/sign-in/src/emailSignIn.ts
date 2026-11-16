import type { AppState } from '@playhoot/app-core';
import type { HttpFailure, IdentityClient } from '@playhoot/communication';
import {
  attemptGoneCode,
  emailCodeLength,
  invalidAddressCode,
  invalidCodeCode,
  rateLimitedCode,
} from '@playhoot/protocol';
import { createStore, type StoreApi } from 'zustand/vanilla';

// Why signing in with a code by email did not happen. Presentation turns each into text.
export type EmailSignInError =
  // What was typed is not an email address. The only thing the backend ever says about an
  // address: nothing here tells whether it has an account.
  | { kind: 'invalid-address' }
  // That is not the code sent to this address; the attempt is still live, so another try works.
  | { kind: 'wrong-code' }
  // Expired, superseded by a newer code, or spent on five wrong tries (V-09): ask for a new one.
  | { kind: 'attempt-gone' }
  | { kind: 'rate-limited'; retryAfterSeconds: number | undefined }
  // The backend could not be reached.
  | { kind: 'unavailable' };

export interface EmailSignInState {
  // `address` while the address is being typed, `code` once one has been asked for. The step is
  // screen state, like the trip to a provider: the attempt itself lives on the backend.
  step: 'address' | 'code';
  // The address the code was asked for, so the completion names the same one.
  address: string;
  status: 'idle' | 'sending' | 'completing';
  error: EmailSignInError | null;
  // A further code was asked for while on the code step, which supersedes the previous one.
  resent: boolean;
}

export interface EmailSignInDeps {
  app: AppState;
  identity: IdentityClient;
}

export interface EmailSignIn {
  store: StoreApi<EmailSignInState>;
  // Asks for a code for this address and opens the code step; false when nothing was sent.
  // `language` is the language the email is written in.
  start(address: string, language: string): Promise<boolean>;
  // Asks for another code for the same address, superseding the one already sent.
  resend(language: string): Promise<boolean>;
  // Exchanges the typed code for the credentials; true once signed in.
  complete(code: string): Promise<boolean>;
  // Back to the address field, keeping what was typed.
  editAddress(): void;
}

// Signing in, or registering, with a one-time code sent by email (P03§8, D-033). A guest who
// does this keeps their name and their games: the attempt was started with the guest's
// credential, so completing it upgrades that same identity (P03§10).
export function createEmailSignIn(deps: EmailSignInDeps): EmailSignIn {
  const store = createStore<EmailSignInState>(() => ({
    step: 'address',
    address: '',
    status: 'idle',
    error: null,
    resent: false,
  }));

  const fail = (error: EmailSignInError) => {
    store.setState({ status: 'idle', error });
    return false as const;
  };

  const ask = async (address: string, language: string, resent: boolean) => {
    store.setState({ status: 'sending', error: null });
    const result = await deps.identity.startEmailLogin(address, language);
    if (!result.ok) return fail(startError(result.error));
    store.setState({ step: 'code', address, status: 'idle', error: null, resent });
    return true;
  };

  return {
    store,
    start(raw, language) {
      const address = raw.trim();
      // Only the shape of an address is checked here, and only enough to not send an empty
      // request: the backend decides what an address is.
      if (!address.includes('@') || address.length < 3) {
        return Promise.resolve(fail({ kind: 'invalid-address' }));
      }
      return ask(address, language, false);
    },
    resend(language) {
      const { address, status } = store.getState();
      if (!address || status !== 'idle') return Promise.resolve(false);
      return ask(address, language, true);
    },
    async complete(raw) {
      const code = raw.trim();
      const { address } = store.getState();
      if (code.length !== emailCodeLength) return fail({ kind: 'wrong-code' });
      store.setState({ status: 'completing', error: null });
      const result = await deps.identity.completeEmailLogin(
        address,
        code,
        deps.app.currentRefreshToken() ?? undefined,
      );
      if (!result.ok) return fail(completeError(result.error));
      deps.app.signIn(result.value);
      store.setState({ status: 'idle', error: null });
      return true;
    },
    editAddress() {
      store.setState({ step: 'address', status: 'idle', error: null, resent: false });
    },
  };
}

function startError(failure: HttpFailure): EmailSignInError {
  if (failure.kind === 'http' && failure.code === invalidAddressCode) {
    return { kind: 'invalid-address' };
  }
  if (failure.kind === 'http' && failure.code === rateLimitedCode) {
    return { kind: 'rate-limited', retryAfterSeconds: failure.retryAfterSeconds };
  }
  return { kind: 'unavailable' };
}

function completeError(failure: HttpFailure): EmailSignInError {
  if (failure.kind !== 'http') return { kind: 'unavailable' };
  if (failure.code === invalidCodeCode) return { kind: 'wrong-code' };
  if (failure.code === attemptGoneCode) return { kind: 'attempt-gone' };
  if (failure.code === rateLimitedCode) {
    return { kind: 'rate-limited', retryAfterSeconds: failure.retryAfterSeconds };
  }
  return { kind: 'unavailable' };
}
