import type { AppState } from '@playhoot/app-core';
import type { IdentityClient, MeClient, MyData } from '@playhoot/communication';
import {
  changeLimitBodySchema,
  changeLimitReachedCode,
  displayNameChangesPerWindow,
  displayNameChangeWindowDays,
  guestDisplayNameMaxLength,
  rateLimitedCode,
} from '@playhoot/protocol';
import { createStore, type StoreApi } from 'zustand/vanilla';

// The person's own corner as state: who they are, what they declared, what they may use, and the
// three things they change from there — their name, the language they read Playhoot in and the
// mode their account is in. Kinds only; the backend's wording never reaches a screen.

export type MyDataError =
  | { kind: 'unauthenticated' }
  | { kind: 'rate-limited'; retryAfterSeconds: number | undefined }
  | { kind: 'unavailable' };

// Why a new name was not kept.
export type RenameError =
  // Empty, too long, or a name the backend does not allow.
  | { kind: 'invalid'; maxLength: number }
  // The rolling window allows no further change yet (V-10); `nextChangeAt` is when it will.
  | { kind: 'limit-reached'; nextChangeAt: string | null }
  | { kind: 'rate-limited'; retryAfterSeconds: number | undefined }
  | { kind: 'unavailable' };

// Why a setting only an account decides was refused.
export type SettingError =
  // A guest asked: guests are always normal, and their language lives in this browser alone.
  { kind: 'not-account' } | { kind: 'unavailable' };

export interface MyDataState {
  status: 'loading' | 'ready' | 'failed';
  data: MyData | null;
  error: MyDataError | null;
  // One of the three changes is being written down.
  saving: 'name' | 'language' | 'mode' | null;
  renameError: RenameError | null;
  settingError: SettingError | null;
  // The last name change went through: the screen says so without inventing a count.
  renamed: boolean;
}

export interface MyDataDeps {
  app: AppState;
  me: MeClient;
  identity: IdentityClient;
}

export interface MyDataFeature {
  store: StoreApi<MyDataState>;
  // Reads the composed answer. Running twice at once reads once.
  load(): Promise<void>;
  // Changes the name other people see; true once it is kept. The allowance is V-10's, and the
  // refusal carries when the next change is possible.
  rename(displayName: string): Promise<boolean>;
  // Stores the language on the account, so its emails follow it. The browser's own preference is
  // the screen's business, not this one's.
  setLanguage(language: string): Promise<boolean>;
  // Switches the account's mode and adopts the fresh access token carrying it.
  setMode(mode: string): Promise<boolean>;
  // Forgets the refusals a screen has already shown.
  dismiss(): void;
}

// What the display name allowance is, so a screen can state it before anything is refused: the
// backend answers only the refusal (D-043).
export const displayNameAllowance = {
  changes: displayNameChangesPerWindow,
  windowDays: displayNameChangeWindowDays,
  maxLength: guestDisplayNameMaxLength,
} as const;

export function createMyData(deps: MyDataDeps): MyDataFeature {
  const store = createStore<MyDataState>(() => ({
    status: 'loading',
    data: null,
    error: null,
    saving: null,
    renameError: null,
    settingError: null,
    renamed: false,
  }));
  let inFlight: Promise<void> | null = null;

  const read = async (): Promise<void> => {
    store.setState((state) => ({ ...state, status: 'loading', error: null }));
    const result = await deps.me.readMyData();
    if (result.ok) {
      store.setState((state) => ({ ...state, status: 'ready', data: result.value, error: null }));
      return;
    }
    const failure = result.error;
    const error: MyDataError =
      failure.kind === 'unauthenticated'
        ? { kind: 'unauthenticated' }
        : failure.kind === 'rate-limited'
          ? { kind: 'rate-limited', retryAfterSeconds: failure.retryAfterSeconds }
          : { kind: 'unavailable' };
    // What was already read stays on screen: a failed reread empties nothing.
    store.setState((state) => ({ ...state, status: 'failed', error }));
  };

  const patchProfile = (change: Partial<MyData['profile']>) => {
    store.setState((state) =>
      state.data
        ? { ...state, data: { ...state.data, profile: { ...state.data.profile, ...change } } }
        : state,
    );
  };

  return {
    store,

    load() {
      inFlight ??= read().finally(() => {
        inFlight = null;
      });
      return inFlight;
    },

    async rename(raw) {
      const displayName = raw.trim();
      if (!displayName || [...displayName].length > displayNameAllowance.maxLength) {
        store.setState((state) => ({
          ...state,
          renameError: { kind: 'invalid', maxLength: displayNameAllowance.maxLength },
          renamed: false,
        }));
        return false;
      }
      store.setState((state) => ({ ...state, saving: 'name', renameError: null, renamed: false }));
      const result = await deps.identity.setDisplayName(displayName);
      if (!result.ok) {
        store.setState((state) => ({
          ...state,
          saving: null,
          renameError: renameErrorOf(result.error),
        }));
        return false;
      }
      const kept = result.value || displayName;
      deps.app.renamed(kept);
      // Renewed in the background so the backend sees the new name too; if it cannot be now, the
      // app keeps trying.
      void deps.app.credentials.refresh?.();
      patchProfile({ displayName: kept });
      store.setState((state) => ({ ...state, saving: null, renameError: null, renamed: true }));
      return true;
    },

    async setLanguage(language) {
      store.setState((state) => ({ ...state, saving: 'language', settingError: null }));
      const result = await deps.me.setLanguage(language);
      if (!result.ok) {
        store.setState((state) => ({
          ...state,
          saving: null,
          settingError: settingErrorOf(result.error.kind),
        }));
        return false;
      }
      patchProfile({ language: result.value });
      store.setState((state) => ({ ...state, saving: null, settingError: null }));
      return true;
    },

    async setMode(mode) {
      store.setState((state) => ({ ...state, saving: 'mode', settingError: null }));
      const result = await deps.me.setMode(mode);
      if (!result.ok) {
        store.setState((state) => ({
          ...state,
          saving: null,
          settingError: settingErrorOf(result.error.kind),
        }));
        return false;
      }
      // The mode rides the access token: adopting it is what makes the next request a teacher's.
      deps.app.accessReissued(result.value.access);
      patchProfile({ mode: result.value.mode });
      store.setState((state) => ({ ...state, saving: null, settingError: null }));
      return true;
    },

    dismiss() {
      store.setState((state) => ({
        ...state,
        renameError: null,
        settingError: null,
        renamed: false,
      }));
    },
  };
}

function renameErrorOf(failure: {
  kind: string;
  status?: number;
  code?: string | undefined;
  retryAfterSeconds?: number | undefined;
  body?: unknown;
}): RenameError {
  if (failure.kind !== 'http') return { kind: 'unavailable' };
  if (failure.code === changeLimitReachedCode) {
    const parsed = changeLimitBodySchema.safeParse(failure.body);
    return {
      kind: 'limit-reached',
      nextChangeAt: parsed.success ? parsed.data.next_change_at : null,
    };
  }
  if (failure.status === 400) return { kind: 'invalid', maxLength: displayNameAllowance.maxLength };
  if (failure.code === rateLimitedCode) {
    return { kind: 'rate-limited', retryAfterSeconds: failure.retryAfterSeconds };
  }
  return { kind: 'unavailable' };
}

function settingErrorOf(kind: string): SettingError {
  return kind === 'not-account' ? { kind: 'not-account' } : { kind: 'unavailable' };
}
