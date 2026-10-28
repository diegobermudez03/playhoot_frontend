import { createStore, type StoreApi } from 'zustand/vanilla';

import type { OperationCatalog } from './access';
import { authSnapshotOf, type AuthSnapshot } from './auth';
import {
  noCredentialRefresh,
  type Credential,
  type CredentialProvider,
  type CredentialRefresher,
  type CredentialStore,
} from './credentials';
import {
  fallbackLocale,
  isSupportedLocale,
  resolveLocale,
  type Locale,
  type LocalePreferenceStore,
} from './locale';

export interface AppGlobalState {
  auth: AuthSnapshot;
  // The backend's catalog of operations and the level each requires, read once at startup.
  operations: OperationCatalog;
  locale: Locale;
}

export interface AppStateOptions {
  credentials: CredentialStore;
  // Renews a refused credential; defaults to never (no authentication backend yet).
  refresher?: CredentialRefresher;
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
  // Keeps the backend's operation catalog (operation -> required level, as the backend wrote it).
  setOperations(requirements: Iterable<{ operation: string; requiredLevel: string }>): void;
  setLocale(locale: Locale): void;
}

// App-global state: only what is truly global (ARCHITECTURE.md, plan §4.4). Feature state lives
// in each feature and is discarded with its route.
export function createAppState(options: AppStateOptions): AppState {
  let credential: Credential | null = null;
  const store = createStore<AppGlobalState>(() => ({
    auth: { status: 'unknown' },
    operations: { status: 'loading' },
    locale: fallbackLocale,
  }));

  const applyCredential = (next: Credential | null) => {
    credential = next;
    store.setState({ auth: authSnapshotOf(next) });
  };

  const refresher = options.refresher ?? noCredentialRefresh;
  let refreshing: Promise<boolean> | null = null;
  const refresh = (): Promise<boolean> => {
    const current = credential;
    if (!current) return Promise.resolve(false);
    refreshing ??= refresher
      .refresh(current)
      .catch(() => null)
      .then((next) => {
        refreshing = null;
        // Signed out or replaced meanwhile: the renewal no longer applies.
        if (!next || credential !== current) return false;
        options.credentials.save(next);
        applyCredential(next);
        return true;
      });
    return refreshing;
  };

  return {
    store,
    credentials: { currentToken: () => credential?.token ?? null, refresh },
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
    setOperations(requirements) {
      const byOperation = new Map<string, string>();
      for (const entry of requirements) byOperation.set(entry.operation, entry.requiredLevel);
      store.setState({ operations: { status: 'ready', requirements: byOperation } });
    },
    setLocale(locale) {
      options.locale.store.save(locale);
      store.setState({ locale });
    },
  };
}
