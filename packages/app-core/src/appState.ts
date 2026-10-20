import { createStore, type StoreApi } from 'zustand/vanilla';

import { authSnapshotOf, type AuthSnapshot } from './auth';
import type { Credential, CredentialProvider, CredentialStore } from './credentials';

export interface AppGlobalState {
  auth: AuthSnapshot;
}

export interface AppState {
  store: StoreApi<AppGlobalState>;
  credentials: CredentialProvider;
  // Reads the persisted credential and resolves the auth snapshot out of `unknown`.
  bootstrap(): void;
  signIn(credential: Credential): void;
  signOut(): void;
}

// App-global state: only what is truly global (ARCHITECTURE.md, plan §4.4). Feature state lives
// in each feature and is discarded with its route.
export function createAppState(credentialStore: CredentialStore): AppState {
  let credential: Credential | null = null;
  const store = createStore<AppGlobalState>(() => ({ auth: { status: 'unknown' } }));

  const apply = (next: Credential | null) => {
    credential = next;
    store.setState({ auth: authSnapshotOf(next) });
  };

  return {
    store,
    credentials: { currentToken: () => credential?.token ?? null },
    bootstrap: () => apply(credentialStore.load()),
    signIn: (next) => {
      credentialStore.save(next);
      apply(next);
    },
    signOut: () => {
      credentialStore.clear();
      apply(null);
    },
  };
}
