import type {
  AcceptanceText,
  ComplianceClient,
  NotificationPreferences,
  NotificationsClient,
} from '@playhoot/communication';
import { acceptanceContexts, type OptionalEmailGroup } from '@playhoot/protocol';
import { createStore, type StoreApi } from 'zustand/vanilla';

// Which optional email a person wants (P31§4, V-07), and the marketing choice, which is an
// acceptance: turning it on records the acceptance of the marketing text at the exact version
// shown, turning it off records the withdrawal (P22§3, D-037). Necessary email is not here —
// it cannot be turned off — and in-app notifications are never trimmed by any of this.

export type PreferencesError =
  | { kind: 'unauthenticated' }
  | { kind: 'busy'; retryAfterSeconds: number | undefined }
  | { kind: 'unavailable' };

export interface PreferencesState {
  status: 'loading' | 'ready' | 'failed';
  preferences: NotificationPreferences | null;
  error: PreferencesError | null;
  // Which switch is being written down, so only that one shows as busy.
  saving: OptionalEmailGroup | 'marketing' | null;
  saveFailed: boolean;
  // The marketing text at its current version, read before it is accepted. Null while nothing
  // is published (P-23) or it could not be read: the toggle then says so and records nothing.
  marketingText: AcceptanceText | null;
  marketingTextMissing: boolean;
}

export interface PreferencesDeps {
  client: NotificationsClient;
  compliance: ComplianceClient;
}

export interface Preferences {
  store: StoreApi<PreferencesState>;
  load(): Promise<void>;
  // Turns one optional group on or off.
  setGroup(group: OptionalEmailGroup, on: boolean): Promise<boolean>;
  // Reads the marketing text so the person sees exactly what they are about to accept.
  readMarketingText(language: string): Promise<AcceptanceText | null>;
  // Records the acceptance or the withdrawal at that version, and only then stores the
  // preference: an unrecorded choice must not look taken.
  setMarketing(on: boolean, language: string): Promise<boolean>;
}

export function createPreferences(deps: PreferencesDeps): Preferences {
  const store = createStore<PreferencesState>(() => ({
    status: 'loading',
    preferences: null,
    error: null,
    saving: null,
    saveFailed: false,
    marketingText: null,
    marketingTextMissing: false,
  }));

  const write = async (
    saving: OptionalEmailGroup | 'marketing',
    next: NotificationPreferences,
  ): Promise<boolean> => {
    store.setState((state) => ({ ...state, saving, saveFailed: false }));
    const result = await deps.client.setPreferences(next);
    if (!result.ok) {
      store.setState((state) => ({ ...state, saving: null, saveFailed: true }));
      return false;
    }
    store.setState((state) => ({
      ...state,
      preferences: result.value,
      saving: null,
      saveFailed: false,
    }));
    return true;
  };

  const readMarketingText = async (language: string): Promise<AcceptanceText | null> => {
    const result = await deps.compliance.readText('marketing', language);
    if (!result.ok) {
      store.setState((state) => ({ ...state, marketingText: null, marketingTextMissing: true }));
      return null;
    }
    store.setState((state) => ({
      ...state,
      marketingText: result.value,
      marketingTextMissing: false,
    }));
    return result.value;
  };

  return {
    store,
    readMarketingText,

    async load() {
      store.setState((state) => ({ ...state, status: 'loading', error: null }));
      const result = await deps.client.readPreferences();
      if (result.ok) {
        store.setState((state) => ({
          ...state,
          status: 'ready',
          preferences: result.value,
          error: null,
        }));
        return;
      }
      const failure = result.error;
      const error: PreferencesError =
        failure.kind === 'unauthenticated'
          ? { kind: 'unauthenticated' }
          : failure.kind === 'busy'
            ? { kind: 'busy', retryAfterSeconds: failure.retryAfterSeconds }
            : { kind: 'unavailable' };
      store.setState((state) => ({ ...state, status: 'failed', error }));
    },

    async setGroup(group, on) {
      const current = store.getState().preferences;
      if (!current) return false;
      return write(group, { ...current, [group]: on });
    },

    async setMarketing(on, language) {
      const current = store.getState().preferences;
      if (!current) return false;
      const text = store.getState().marketingText ?? (await readMarketingText(language));
      if (!text) return false;
      store.setState((state) => ({ ...state, saving: 'marketing', saveFailed: false }));
      const recorded = await deps.compliance.recordAcceptance(
        text.kind,
        text.version,
        text.language,
        on ? 'accepted' : 'withdrawn',
        acceptanceContexts.preferences,
      );
      if (!recorded.ok) {
        store.setState((state) => ({ ...state, saving: null, saveFailed: true }));
        return false;
      }
      return write('marketing', { ...current, marketing: on });
    },
  };
}
