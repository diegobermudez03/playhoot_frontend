import type { AppState } from '@playhoot/app-core';
import type { HttpFailure, IdentityClient } from '@playhoot/communication';
import {
  loginCompletionErrors,
  methodInUseCode,
  providerUnavailableCode,
  rateLimitedCode,
  type LoginCompletionError,
} from '@playhoot/protocol';
import { createStore, type StoreApi } from 'zustand/vanilla';

// Why signing in with an account did not happen. Presentation turns each into text.
export type AccountSignInError =
  // The person declined at the provider.
  | { kind: 'cancelled' }
  // The provider is not enabled on this backend.
  | { kind: 'provider-unavailable' }
  | { kind: 'rate-limited'; retryAfterSeconds: number | undefined }
  // The backend or the provider could not be reached.
  | { kind: 'unavailable' }
  // Anything else: an attempt that expired, was used, or was started elsewhere. Start again.
  | { kind: 'failed' };

export interface AccountSignInState {
  status: 'idle' | 'starting' | 'leaving' | 'completing' | 'failed';
  error: AccountSignInError | null;
  // The providers the backend offers; null until known (or while it cannot be reached).
  providers: readonly string[] | null;
}

// A sign-in in progress, kept while the page goes to the provider and back. Holds the verifier,
// which never leaves this browser tab.
export interface PendingLogin {
  verifier: string;
  // Where to go once signed in.
  next: string | null;
  startedAt: number;
  // What the trip was for: entering an account, or adding this provider as another way into the
  // account already signed in. An entry written before this existed reads as a sign-in.
  intent?: LoginIntent;
}

export type LoginIntent = 'sign-in' | 'link';

// Where the pending sign-in survives the trip to the provider (web: this tab's sessionStorage).
// `take` returns it once and forgets it.
export interface PendingLoginStore {
  save(pending: PendingLogin): void;
  take(): PendingLogin | null;
}

export interface AccountSignInDeps {
  app: AppState;
  identity: IdentityClient;
  pending: PendingLoginStore;
  // A random verifier (at least 43 characters) and its S256 code challenge.
  newVerifier: () => string;
  challengeOf: (verifier: string) => Promise<string>;
  // Leaves the app for the provider's page.
  leaveTo: (url: string) => void;
  now?: () => number;
}

// What the provider's answer sent to the completion route.
export interface LoginCompletion {
  code: string | null;
  error: string | null;
}

// What a finished round trip turned out to be.
export type LoginCompleted =
  | { kind: 'signed-in'; next: string | null }
  // The trip was for adding a way in: `linked`, or `in-use` when that identity is another
  // account's way in (matching addresses never merge accounts, P03§11).
  | { kind: 'linked'; outcome: 'linked' | 'in-use'; next: string | null };

export interface AccountSignIn {
  store: StoreApi<AccountSignInState>;
  // Learns which providers the backend offers, once; false when the backend could not be reached
  // (the next call tries again).
  loadProviders(): Promise<boolean>;
  // Sends the person to the provider; `next` is where to go once they are back and signed in.
  start(provider: string, next: string | null): Promise<void>;
  // Sends the person to the provider to add it as another way into the account already signed
  // in; `next` is where to go once they are back.
  startLink(provider: string, next: string | null): Promise<void>;
  // Finishes the round trip the provider answered, whichever it was. `false` with the error in
  // the store when it did not finish.
  complete(completion: LoginCompletion): Promise<LoginCompleted | false>;
}

// How long a pending sign-in may wait for the provider's answer (the backend allows 5 minutes).
export const pendingLoginLifetimeMs = 10 * 60_000;

// Signing in with an account through a provider (Google; the local fictitious one in development).
// A guest held until now is replaced, not converted: its session ends with the sign-in, and its
// games stay with the guest.
export function createAccountSignIn(deps: AccountSignInDeps): AccountSignIn {
  const now = deps.now ?? Date.now;
  const store = createStore<AccountSignInState>(() => ({
    status: 'idle',
    error: null,
    providers: null,
  }));
  let loading: Promise<boolean> | null = null;
  const fail = (error: AccountSignInError) => {
    store.setState({ status: 'failed', error });
    return false as const;
  };

  return {
    store,
    loadProviders() {
      if (store.getState().providers) return Promise.resolve(true);
      loading ??= deps.identity.listLoginProviders().then((result) => {
        loading = null;
        if (result.ok) store.setState({ providers: result.value });
        return result.ok;
      });
      return loading;
    },
    async start(provider, next) {
      store.setState({ status: 'starting', error: null });
      const verifier = deps.newVerifier();
      const challenge = await deps.challengeOf(verifier);
      const result = await deps.identity.startLogin(provider, challenge);
      if (!result.ok) {
        fail(startError(result.error));
        return;
      }
      deps.pending.save({ verifier, next, startedAt: now(), intent: 'sign-in' });
      store.setState({ status: 'leaving', error: null });
      deps.leaveTo(result.value);
    },
    async startLink(provider, next) {
      store.setState({ status: 'starting', error: null });
      const verifier = deps.newVerifier();
      const challenge = await deps.challengeOf(verifier);
      const result = await deps.identity.startLinkProvider(provider, challenge);
      if (!result.ok) {
        fail(startError(result.error));
        return;
      }
      deps.pending.save({ verifier, next, startedAt: now(), intent: 'link' });
      store.setState({ status: 'leaving', error: null });
      deps.leaveTo(result.value);
    },
    async complete(completion) {
      const pending = deps.pending.take();
      if (completion.error !== null) return fail(completionError(completion.error));
      if (!completion.code || !pending || now() - pending.startedAt > pendingLoginLifetimeMs) {
        return fail({ kind: 'failed' });
      }
      store.setState({ status: 'completing', error: null });
      if (pending.intent === 'link') {
        const linked = await deps.identity.completeLinkProvider(completion.code, pending.verifier);
        if (!linked.ok) {
          const failure = linked.error;
          if (failure.kind === 'http' && failure.code === methodInUseCode) {
            store.setState({ status: 'idle', error: null });
            return { kind: 'linked', outcome: 'in-use', next: pending.next };
          }
          return fail(
            failure.kind === 'network' || (failure.kind === 'http' && failure.status >= 500)
              ? { kind: 'unavailable' }
              : { kind: 'failed' },
          );
        }
        store.setState({ status: 'idle', error: null });
        return { kind: 'linked', outcome: 'linked', next: pending.next };
      }
      const result = await deps.identity.completeLogin(
        completion.code,
        pending.verifier,
        deps.app.currentRefreshToken() ?? undefined,
      );
      if (!result.ok) {
        const failure = result.error;
        return fail(
          failure.kind === 'network' || (failure.kind === 'http' && failure.status >= 500)
            ? { kind: 'unavailable' }
            : { kind: 'failed' },
        );
      }
      deps.app.signIn(result.value);
      store.setState({ status: 'idle', error: null });
      return { kind: 'signed-in', next: pending.next };
    },
  };
}

function startError(failure: HttpFailure): AccountSignInError {
  if (failure.kind === 'http' && failure.code === providerUnavailableCode) {
    return { kind: 'provider-unavailable' };
  }
  if (failure.kind === 'http' && failure.code === rateLimitedCode) {
    return { kind: 'rate-limited', retryAfterSeconds: failure.retryAfterSeconds };
  }
  if (failure.kind === 'network' || (failure.kind === 'http' && failure.status >= 500)) {
    return { kind: 'unavailable' };
  }
  return { kind: 'failed' };
}

function completionError(error: string): AccountSignInError {
  const known = (loginCompletionErrors as readonly string[]).includes(error)
    ? (error as LoginCompletionError)
    : 'failed';
  return known === 'cancelled'
    ? { kind: 'cancelled' }
    : known === 'unavailable'
      ? { kind: 'unavailable' }
      : { kind: 'failed' };
}
