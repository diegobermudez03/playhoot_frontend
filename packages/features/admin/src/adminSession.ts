import type { CredentialProvider } from '@playhoot/app-core';
import type { AdminTokenResponse } from '@playhoot/protocol';
import { createStore, type StoreApi } from 'zustand/vanilla';

// Admin mode as this browser tab knows it. The token itself is never in the store: it lives in a
// closure, is never written to storage, and goes away with the tab (D-023).
export interface AdminSessionState {
  status: 'none' | 'active';
  // The account the admin token was issued to, and when it lapses (epoch ms on this device's
  // clock). Both null while there is no admin mode.
  userUUID: string | null;
  expiresAt: number | null;
}

export interface AdminSession {
  store: StoreApi<AdminSessionState>;
  // What the admin HTTP client attaches. Null once there is no admin mode, or the token lapsed.
  credentials: CredentialProvider;
  // Adopts the token a verified code bought.
  hold(token: AdminTokenResponse): void;
  // Leaves admin mode, on purpose or because the backend refused the token.
  release(): void;
}

export interface AdminSessionDeps {
  now?: () => number;
  // Runs `run` after `delayMs` and returns a cancel function. Defaults to setTimeout.
  schedule?: (run: () => void, delayMs: number) => () => void;
}

// A token this close to its expiry is treated as gone, so a request is never started with a
// credential that will have lapsed by the time the backend reads it.
export const adminTokenMarginMs = 2_000;

export function createAdminSession(deps: AdminSessionDeps = {}): AdminSession {
  const now = deps.now ?? Date.now;
  const schedule =
    deps.schedule ??
    ((run, delayMs) => {
      const id = setTimeout(run, delayMs);
      return () => clearTimeout(id);
    });
  const store = createStore<AdminSessionState>(() => ({
    status: 'none',
    userUUID: null,
    expiresAt: null,
  }));
  let token: string | null = null;
  let expiresAt = 0;
  let cancelTimer: (() => void) | null = null;

  const release = () => {
    cancelTimer?.();
    cancelTimer = null;
    token = null;
    expiresAt = 0;
    if (store.getState().status !== 'none') {
      store.setState({ status: 'none', userUUID: null, expiresAt: null });
    }
  };

  return {
    store,
    credentials: {
      currentToken: () => (token && now() + adminTokenMarginMs < expiresAt ? token : null),
    },
    hold(issued) {
      cancelTimer?.();
      // The lifetime is measured on this device's clock, so a clock that is off neither keeps a
      // lapsed token nor drops a good one (as the account credential does).
      expiresAt = now() + issued.access_expires_in * 1000;
      token = issued.access_token;
      store.setState({ status: 'active', userUUID: issued.user_uuid, expiresAt });
      cancelTimer = schedule(release, Math.max(issued.access_expires_in * 1000, 0));
    },
    release,
  };
}
