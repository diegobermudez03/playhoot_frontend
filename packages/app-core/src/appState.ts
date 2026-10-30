import { createStore, type StoreApi } from 'zustand/vanilla';

import type { OperationCatalog } from './access';
import { authSnapshotOf, type AuthSnapshot } from './auth';
import {
  noCredentialRefresh,
  type Credential,
  type CredentialProvider,
  type CredentialRefresher,
  type CredentialStore,
  type RefreshOutcome,
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
  // Renews a credential with its refresh token; defaults to never (no authentication backend).
  refresher?: CredentialRefresher;
  // Ends a session on the backend when the person signs out. Best effort: signing out locally
  // never waits for it.
  revoke?: (refreshToken: string) => Promise<unknown>;
  // Runs `run` after `delayMs`; returns a cancel function. Defaults to setTimeout.
  schedule?: (run: () => void, delayMs: number) => () => void;
  now?: () => number;
  locale: {
    store: LocalePreferenceStore;
    // The languages the device prefers, most preferred first (e.g. `navigator.languages`).
    devicePreferences: () => readonly string[];
  };
}

export interface AppState {
  store: StoreApi<AppGlobalState>;
  credentials: CredentialProvider;
  // Reads the persisted credential and language. A stored credential is renewed before it is used:
  // meanwhile the auth snapshot stays `unknown`.
  bootstrap(): void;
  signIn(credential: Credential): void;
  // The refresh token of the identity in use, so signing in as someone else can end its session.
  currentRefreshToken(): string | null;
  // The identity in use was renamed on the backend: shows the new name right away. Its access
  // token still carries the old one until renewed.
  renamed(displayName: string): void;
  // Forgets the credential, and ends its session on the backend.
  signOut(): void;
  // Renews the access token now if it expires within a minute (when the page becomes visible again
  // after its timers slept).
  ensureFresh(): void;
  // Another tab changed the stored credential: follow it (signed out, another person, a rotated
  // refresh token).
  syncFromStore(): void;
  // Keeps the backend's operation catalog (operation -> required level, as the backend wrote it).
  setOperations(requirements: Iterable<{ operation: string; requiredLevel: string }>): void;
  setLocale(locale: Locale): void;
}

// How long before the access token expires it is renewed.
export const renewBeforeExpiryMs = 60_000;
// The shortest wait before a scheduled renewal, so a token that comes back already close to its
// expiry never renews in a loop.
export const minRenewDelayMs = 5_000;
// Waits between renewal attempts while the backend cannot be reached.
export const renewRetryDelaysMs = [1000, 2000, 4000, 8000, 16_000, 30_000] as const;

// App-global state: only what is truly global (ARCHITECTURE.md, plan §4.4). Feature state lives
// in each feature and is discarded with its route.
export function createAppState(options: AppStateOptions): AppState {
  const schedule =
    options.schedule ??
    ((run, delayMs) => {
      const id = setTimeout(run, delayMs);
      return () => clearTimeout(id);
    });
  const now = options.now ?? Date.now;
  const refresher = options.refresher ?? noCredentialRefresh;

  let credential: Credential | null = null;
  // Changes whenever the person changes (signed in, signed out, another tab's person adopted): a
  // renewal started for an earlier one never applies.
  let generation = 0;
  // Renewals in a row that could not reach the backend.
  let failures = 0;
  let cancelTimer: (() => void) | null = null;
  const store = createStore<AppGlobalState>(() => ({
    auth: { status: 'unknown' },
    operations: { status: 'loading' },
    locale: fallbackLocale,
  }));

  const setTimer = (run: () => void, delayMs: number) => {
    cancelTimer?.();
    cancelTimer = schedule(() => {
      cancelTimer = null;
      run();
    }, delayMs);
  };
  const clearTimer = () => {
    cancelTimer?.();
    cancelTimer = null;
  };

  // Adopts a usable credential and schedules its renewal before the access token expires.
  const activate = (next: Credential) => {
    credential = next;
    store.setState({ auth: authSnapshotOf(next) });
    clearTimer();
    if (next.expiresAt !== undefined && next.refreshToken) {
      const delay = next.expiresAt - now() - renewBeforeExpiryMs;
      setTimer(() => void refresh(), Math.max(minRenewDelayMs, delay));
    }
  };
  const forget = () => {
    generation++;
    credential = null;
    clearTimer();
    options.credentials.clear();
    store.setState({ auth: { status: 'none' } });
  };

  let refreshing: { generation: number; result: Promise<RefreshOutcome['kind']> } | null = null;
  const refresh = (): Promise<RefreshOutcome['kind']> => {
    const current = credential;
    if (!current?.refreshToken) return Promise.resolve('invalid');
    if (refreshing?.generation === generation) return refreshing.result;
    const startedFor = generation;
    // Another tab may have rotated the refresh token since this one read it.
    const stored = options.credentials.load();
    const latest =
      stored?.userUUID === current.userUUID && stored.refreshToken
        ? { ...current, refreshToken: stored.refreshToken }
        : current;
    const result = refresher
      .refresh(latest)
      .catch((): RefreshOutcome => ({ kind: 'unavailable' }))
      .then((outcome): RefreshOutcome['kind'] => {
        if (refreshing?.result === result) refreshing = null;
        // Signed out or someone else meanwhile: the renewal no longer applies, and its caller
        // must not take it as renewed.
        if (generation !== startedFor) return 'unavailable';
        if (outcome.kind === 'renewed') {
          failures = 0;
          options.credentials.save(outcome.credential);
          activate(outcome.credential);
        } else if (outcome.kind === 'invalid') {
          forget();
        } else {
          // Tried again while the backend cannot be reached, never creating another identity.
          const delay = renewRetryDelaysMs[Math.min(failures, renewRetryDelaysMs.length - 1)]!;
          failures++;
          setTimer(() => void refresh(), delay);
        }
        return outcome.kind;
      });
    refreshing = { generation: startedFor, result };
    return result;
  };

  // A stored credential has no access token: it is renewed before anything uses it.
  const adopt = (stored: Credential | null) => {
    generation++;
    failures = 0;
    clearTimer();
    if (!stored) {
      credential = null;
      store.setState({ auth: { status: 'none' } });
    } else if (!stored.token && stored.refreshToken) {
      credential = stored;
      store.setState({ auth: { status: 'unknown' } });
      void refresh();
    } else {
      activate(stored);
    }
  };

  return {
    store,
    credentials: { currentToken: () => credential?.token || null, refresh },
    bootstrap() {
      adopt(options.credentials.load());
      const saved = options.locale.store.load();
      store.setState({
        locale:
          saved && isSupportedLocale(saved)
            ? saved
            : resolveLocale(options.locale.devicePreferences()),
      });
    },
    signIn(next) {
      generation++;
      failures = 0;
      options.credentials.save(next);
      activate(next);
    },
    currentRefreshToken() {
      return credential?.refreshToken ?? null;
    },
    renamed(displayName) {
      if (!credential) return;
      credential = { ...credential, displayName };
      options.credentials.save(credential);
      store.setState({ auth: authSnapshotOf(credential) });
    },
    signOut() {
      const refreshToken = credential?.refreshToken;
      forget();
      if (refreshToken) void options.revoke?.(refreshToken).catch(() => undefined);
    },
    ensureFresh() {
      const expiresAt = credential?.expiresAt;
      if (expiresAt !== undefined && expiresAt - now() < renewBeforeExpiryMs) void refresh();
    },
    syncFromStore() {
      const stored = options.credentials.load();
      if (!stored || !credential || stored.userUUID !== credential.userUUID) {
        adopt(stored);
        return;
      }
      // The same person: only the refresh token may have rotated, and a renewal in flight still
      // applies.
      if (stored.refreshToken && stored.refreshToken !== credential.refreshToken) {
        credential = { ...credential, refreshToken: stored.refreshToken };
      }
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
