import { createStore, type StoreApi } from 'zustand/vanilla';

import { authSnapshotOf, type AuthSnapshot } from './auth';
import type { Credential, CredentialProvider, CredentialStore } from './credentials';
import {
  fallbackLocale,
  isSupportedLocale,
  resolveLocale,
  type Locale,
  type LocalePreferenceStore,
} from './locale';

export interface AppGlobalState {
  auth: AuthSnapshot;
  locale: Locale;
}

export interface AppStateOptions {
  credentials: CredentialStore;
  locale: {
    store: LocalePreferenceStore;
    // The languages the device prefers, most preferred first (e.g. `navigator.languages`).
    devicePreferences: () => readonly string[];
  };
}

export interface AppState {
  store: StoreApi<AppGlobalState>;
  credentials: CredentialProvider;
  // Reads the persisted credential and language: the auth snapshot leaves `unknown`, and the
  // language becomes the saved choice or the best match for the device.
  bootstrap(): void;
  signIn(credential: Credential): void;
  signOut(): void;
  setLocale(locale: Locale): void;
}

// App-global state: only what is truly global (ARCHITECTURE.md, plan §4.4). Feature state lives
// in each feature and is discarded with its route.
export function createAppState(options: AppStateOptions): AppState {
  let credential: Credential | null = null;
  const store = createStore<AppGlobalState>(() => ({
    auth: { status: 'unknown' },
    locale: fallbackLocale,
  }));

  const applyCredential = (next: Credential | null) => {
    credential = next;
    store.setState({ auth: authSnapshotOf(next) });
  };

  return {
    store,
    credentials: { currentToken: () => credential?.token ?? null },
    bootstrap() {
      applyCredential(options.credentials.load());
      const saved = options.locale.store.load();
      store.setState({
        locale:
          saved && isSupportedLocale(saved)
            ? saved
            : resolveLocale(options.locale.devicePreferences()),
      });
    },
    signIn(next) {
      options.credentials.save(next);
      applyCredential(next);
    },
    signOut() {
      options.credentials.clear();
      applyCredential(null);
    },
    setLocale(locale) {
      options.locale.store.save(locale);
      store.setState({ locale });
    },
  };
}
