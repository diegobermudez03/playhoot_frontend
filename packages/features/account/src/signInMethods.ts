import type { HttpFailure, IdentityClient, SignInMethod } from '@playhoot/communication';
import {
  attemptGoneCode,
  invalidAddressCode,
  invalidCodeCode,
  lastMethodCode,
  methodInUseCode,
  noSuchMethodCode,
  rateLimitedCode,
} from '@playhoot/protocol';
import { createStore, type StoreApi } from 'zustand/vanilla';

// The ways into an account (P03§11-12, D-035): listing them, adding an address with a code,
// and removing one while another remains. The provider round trip is not here — it leaves the
// page and comes back through the completion route, which is `accountSignIn`'s business.

export type MethodsError =
  | { kind: 'unauthenticated' }
  | { kind: 'rate-limited'; retryAfterSeconds: number | undefined }
  | { kind: 'unavailable' };

// Why adding an address did not finish.
export type LinkEmailError =
  // Not an address at all (the only refusal the start step makes that says anything).
  | { kind: 'invalid-address' }
  // That is not the code sent; the attempt is still live, so another try is possible.
  | { kind: 'wrong-code' }
  // Expired, superseded, or spent on five wrong tries: ask for a new code (V-09).
  | { kind: 'attempt-gone' }
  // That address is another account's way in, and matching addresses never merge (P03§11).
  | { kind: 'in-use' }
  | { kind: 'rate-limited'; retryAfterSeconds: number | undefined }
  | { kind: 'unavailable' };

// Why a way in was not removed.
export type RemoveMethodError =
  // The only one left: an account must stay reachable (P03§12).
  { kind: 'last-method' } | { kind: 'unknown' } | { kind: 'unavailable' };

export interface SignInMethodsState {
  status: 'loading' | 'ready' | 'failed';
  methods: readonly SignInMethod[];
  error: MethodsError | null;
  // Adding an address: `address` while the address is typed, `code` once one was sent to it.
  adding: { step: 'address' | 'code'; email: string } | null;
  // A step of the email round trip is with the backend.
  busy: boolean;
  linkError: LinkEmailError | null;
  // The address just became another way in.
  linked: boolean;
  removing: string | null;
  removeError: RemoveMethodError | null;
}

export interface SignInMethodsDeps {
  identity: IdentityClient;
}

export interface SignInMethods {
  store: StoreApi<SignInMethodsState>;
  load(): Promise<void>;
  // Asks for a code to be sent to the address. The acknowledgement says nothing about the
  // address, so the screen simply moves on to the code step.
  startEmail(email: string, language: string): Promise<boolean>;
  // Types the six digits; true once the address is linked.
  completeEmail(code: string): Promise<boolean>;
  // Goes back to typing an address (a lost code is recovered by asking for a new one, P31§3).
  cancelEmail(): void;
  remove(methodID: string): Promise<boolean>;
  dismiss(): void;
}

export function createSignInMethods(deps: SignInMethodsDeps): SignInMethods {
  const store = createStore<SignInMethodsState>(() => ({
    status: 'loading',
    methods: [],
    error: null,
    adding: null,
    busy: false,
    linkError: null,
    linked: false,
    removing: null,
    removeError: null,
  }));
  let inFlight: Promise<void> | null = null;

  const read = async (): Promise<void> => {
    store.setState((state) => ({ ...state, status: 'loading', error: null }));
    const result = await deps.identity.listSignInMethods();
    if (result.ok) {
      store.setState((state) => ({
        ...state,
        status: 'ready',
        methods: result.value,
        error: null,
      }));
      return;
    }
    store.setState((state) => ({
      ...state,
      status: 'failed',
      error: methodsErrorOf(result.error),
    }));
  };

  return {
    store,

    load() {
      inFlight ??= read().finally(() => {
        inFlight = null;
      });
      return inFlight;
    },

    async startEmail(raw, language) {
      const email = raw.trim();
      if (!email) {
        store.setState((state) => ({ ...state, linkError: { kind: 'invalid-address' } }));
        return false;
      }
      store.setState((state) => ({ ...state, busy: true, linkError: null, linked: false }));
      const result = await deps.identity.startLinkEmail(email, language);
      if (!result.ok) {
        store.setState((state) => ({
          ...state,
          busy: false,
          linkError: linkErrorOf(result.error),
        }));
        return false;
      }
      store.setState((state) => ({
        ...state,
        busy: false,
        adding: { step: 'code', email },
        linkError: null,
      }));
      return true;
    },

    async completeEmail(code) {
      const adding = store.getState().adding;
      if (!adding) return false;
      store.setState((state) => ({ ...state, busy: true, linkError: null }));
      const result = await deps.identity.completeLinkEmail(adding.email, code);
      if (!result.ok) {
        store.setState((state) => ({
          ...state,
          busy: false,
          linkError: linkErrorOf(result.error),
        }));
        return false;
      }
      store.setState((state) => ({
        ...state,
        busy: false,
        adding: null,
        linkError: null,
        linked: true,
      }));
      await read();
      return true;
    },

    cancelEmail() {
      store.setState((state) => ({ ...state, adding: null, linkError: null, busy: false }));
    },

    async remove(methodID) {
      store.setState((state) => ({ ...state, removing: methodID, removeError: null }));
      const result = await deps.identity.removeSignInMethod(methodID);
      if (!result.ok) {
        store.setState((state) => ({
          ...state,
          removing: null,
          removeError: removeErrorOf(result.error),
        }));
        return false;
      }
      store.setState((state) => ({ ...state, removing: null, removeError: null }));
      await read();
      return true;
    },

    dismiss() {
      store.setState((state) => ({
        ...state,
        linkError: null,
        removeError: null,
        linked: false,
      }));
    },
  };
}

function methodsErrorOf(failure: HttpFailure): MethodsError {
  if (failure.kind !== 'http') return { kind: 'unavailable' };
  if (failure.status === 401 || failure.status === 403) return { kind: 'unauthenticated' };
  if (failure.code === rateLimitedCode || failure.status === 429) {
    return { kind: 'rate-limited', retryAfterSeconds: failure.retryAfterSeconds };
  }
  return { kind: 'unavailable' };
}

function linkErrorOf(failure: HttpFailure): LinkEmailError {
  if (failure.kind !== 'http') return { kind: 'unavailable' };
  switch (failure.code) {
    case invalidAddressCode:
      return { kind: 'invalid-address' };
    case invalidCodeCode:
      return { kind: 'wrong-code' };
    case attemptGoneCode:
      return { kind: 'attempt-gone' };
    case methodInUseCode:
      return { kind: 'in-use' };
    case rateLimitedCode:
      return { kind: 'rate-limited', retryAfterSeconds: failure.retryAfterSeconds };
    default:
      return failure.status === 429
        ? { kind: 'rate-limited', retryAfterSeconds: failure.retryAfterSeconds }
        : { kind: 'unavailable' };
  }
}

function removeErrorOf(failure: HttpFailure): RemoveMethodError {
  if (failure.kind !== 'http') return { kind: 'unavailable' };
  if (failure.code === lastMethodCode) return { kind: 'last-method' };
  if (failure.code === noSuchMethodCode) return { kind: 'unknown' };
  return { kind: 'unavailable' };
}
