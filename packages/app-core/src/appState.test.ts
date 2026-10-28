import { describe, expect, it, vi } from 'vitest';

import { createAppState } from './appState';
import type {
  Credential,
  CredentialRefresher,
  CredentialStore,
  RefreshOutcome,
} from './credentials';
import { resolveLocale, type LocalePreferenceStore } from './locale';

function memoryStore(
  initial: Credential | null = null,
): CredentialStore & { value: Credential | null } {
  return {
    value: initial,
    load() {
      return this.value;
    },
    save(credential) {
      this.value = credential;
    },
    clear() {
      this.value = null;
    },
  };
}

function localeStore(
  initial: string | null = null,
): LocalePreferenceStore & { value: string | null } {
  return {
    value: initial,
    load() {
      return this.value;
    },
    save(locale) {
      this.value = locale;
    },
  };
}

function app(
  options: { credential?: Credential | null; saved?: string | null; device?: string[] } = {},
) {
  const credentials = memoryStore(options.credential ?? null);
  const locales = localeStore(options.saved ?? null);
  const state = createAppState({
    credentials,
    locale: { store: locales, devicePreferences: () => options.device ?? [] },
  });
  return { state, credentials, locales };
}

const guest: Credential = { token: 't-guest', userUUID: 'u-1', kind: 'guest' };

describe('createAppState', () => {
  it('starts unknown and resolves from the persisted credential on bootstrap', () => {
    const { state } = app({ credential: guest });
    expect(state.store.getState().auth).toEqual({ status: 'unknown' });
    expect(state.credentials.currentToken()).toBeNull();

    state.bootstrap();

    expect(state.store.getState().auth).toEqual({
      status: 'guest',
      userUUID: 'u-1',
      displayName: null,
    });
    expect(state.credentials.currentToken()).toBe('t-guest');
  });

  it('resolves to none when nothing is persisted', () => {
    const { state } = app();
    state.bootstrap();
    expect(state.store.getState().auth).toEqual({ status: 'none' });
  });

  it('persists on sign in and forgets on sign out', () => {
    const { state, credentials } = app();
    state.bootstrap();

    state.signIn({ token: 't-acc', userUUID: 'u-2', kind: 'account', displayName: 'Ana' });
    expect(credentials.value?.token).toBe('t-acc');
    expect(state.store.getState().auth).toEqual({
      status: 'authenticated',
      userUUID: 'u-2',
      displayName: 'Ana',
    });

    state.signOut();
    expect(credentials.value).toBeNull();
    expect(state.credentials.currentToken()).toBeNull();
    expect(state.store.getState().auth).toEqual({ status: 'none' });
  });

  it('takes the language from the device unless the person chose one', () => {
    const fromDevice = app({ device: ['pt-PT', 'en'] });
    fromDevice.state.bootstrap();
    expect(fromDevice.state.store.getState().locale).toBe('pt-BR');

    const chosen = app({ saved: 'es', device: ['en'] });
    chosen.state.bootstrap();
    expect(chosen.state.store.getState().locale).toBe('es');

    const stale = app({ saved: 'xx', device: ['en-US'] });
    stale.state.bootstrap();
    expect(stale.state.store.getState().locale).toBe('en');
  });

  it('persists a language change', () => {
    const { state, locales } = app({ device: ['en'] });
    state.bootstrap();
    state.setLocale('pt-BR');
    expect(locales.value).toBe('pt-BR');
    expect(state.store.getState().locale).toBe('pt-BR');
  });
});

describe('resolveLocale', () => {
  it.each([
    [['es-CO'], 'es'],
    [['pt-BR'], 'pt-BR'],
    [['pt'], 'pt-BR'],
    [['fr-FR', 'es'], 'es'],
    [['fr-FR'], 'en'],
    [[], 'en'],
  ])('%j -> %s', (preferences, expected) => {
    expect(resolveLocale(preferences)).toBe(expected);
  });
});

describe('credential refresh', () => {
  const stored: Credential = { token: '', refreshToken: 'r-1', userUUID: 'u-1', kind: 'guest' };
  const renewedGuest = (
    token: string,
    refreshToken = 'r-1',
    expiresAt = 1_000_000,
  ): Credential => ({
    token,
    refreshToken,
    expiresAt,
    userUUID: 'u-1',
    kind: 'guest',
  });

  function renewing(
    options: {
      credential?: Credential | null;
      refresh?: CredentialRefresher['refresh'];
      revoke?: (refreshToken: string) => Promise<unknown>;
    } = {},
  ) {
    const credentials = memoryStore(options.credential === undefined ? stored : options.credential);
    const timers: { run: () => void; delayMs: number; cancelled: boolean }[] = [];
    const refresh = vi.fn(options.refresh ?? (() => Promise.resolve({ kind: 'invalid' as const })));
    const state = createAppState({
      credentials,
      refresher: { refresh },
      ...(options.revoke && { revoke: options.revoke }),
      now: () => 0,
      schedule: (run, delayMs) => {
        // A timer that ran is no longer pending.
        const timer = {
          run: () => {
            timer.cancelled = true;
            run();
          },
          delayMs,
          cancelled: false,
        };
        timers.push(timer);
        return () => (timer.cancelled = true);
      },
      locale: { store: localeStore(), devicePreferences: () => [] },
    });
    const pending = () => timers.filter((timer) => !timer.cancelled);
    return { state, credentials, refresh, pending };
  }

  it('never renews without an authentication backend', async () => {
    const state = createAppState({
      credentials: memoryStore({ ...guest, refreshToken: 'r-1' }),
      locale: { store: localeStore(), devicePreferences: () => [] },
    });
    state.bootstrap();
    await expect(state.credentials.refresh?.()).resolves.toBe('invalid');
  });

  it('restores a stored credential before anything uses it', async () => {
    const t = renewing({
      refresh: () => Promise.resolve({ kind: 'renewed', credential: renewedGuest('a-1') }),
    });
    t.state.bootstrap();
    expect(t.state.store.getState().auth).toEqual({ status: 'unknown' });
    expect(t.state.credentials.currentToken()).toBeNull();

    await vi.waitFor(() => expect(t.state.credentials.currentToken()).toBe('a-1'));
    expect(t.refresh).toHaveBeenCalledWith(stored);
    expect(t.state.store.getState().auth).toMatchObject({ status: 'guest', userUUID: 'u-1' });
    expect(t.credentials.value?.token).toBe('a-1');
  });

  it('forgets a stored credential the backend refuses', async () => {
    const t = renewing();
    t.state.bootstrap();
    await vi.waitFor(() => expect(t.state.store.getState().auth).toEqual({ status: 'none' }));
    expect(t.credentials.value).toBeNull();
  });

  it('keeps trying to restore while the backend cannot be reached, never forgetting', async () => {
    let answer: RefreshOutcome = { kind: 'unavailable' };
    const t = renewing({ refresh: () => Promise.resolve(answer) });
    t.state.bootstrap();
    await vi.waitFor(() => expect(t.pending()).toHaveLength(1));
    expect(t.pending()[0]!.delayMs).toBe(1000);
    expect(t.state.store.getState().auth).toEqual({ status: 'unknown' });
    expect(t.credentials.value).toEqual(stored);

    answer = { kind: 'renewed', credential: renewedGuest('a-1') };
    t.pending()[0]!.run();
    await vi.waitFor(() => expect(t.state.credentials.currentToken()).toBe('a-1'));
  });

  it('renews a minute before the access token expires', async () => {
    const t = renewing({
      credential: null,
      refresh: () =>
        Promise.resolve({ kind: 'renewed', credential: renewedGuest('a-2', 'r-1', 2_000_000) }),
    });
    t.state.bootstrap();
    t.state.signIn(renewedGuest('a-1', 'r-1', 900_000));
    expect(t.pending()).toHaveLength(1);
    expect(t.pending()[0]!.delayMs).toBe(900_000 - 60_000);

    t.pending()[0]!.run();
    await vi.waitFor(() => expect(t.state.credentials.currentToken()).toBe('a-2'));
    expect(t.pending()[0]!.delayMs).toBe(2_000_000 - 60_000);
  });

  it('renews with the refresh token another tab stored', async () => {
    const t = renewing({ credential: null });
    t.state.bootstrap();
    t.state.signIn(renewedGuest('a-1', 'r-old'));
    t.credentials.value = { ...stored, refreshToken: 'r-rotated' };

    await t.state.credentials.refresh?.();

    expect(t.refresh).toHaveBeenCalledWith(expect.objectContaining({ refreshToken: 'r-rotated' }));
  });

  it('shares one renewal between concurrent calls', async () => {
    const t = renewing({
      credential: null,
      refresh: () => Promise.resolve({ kind: 'renewed', credential: renewedGuest('a-2') }),
    });
    t.state.bootstrap();
    t.state.signIn(renewedGuest('a-1'));
    const results = await Promise.all([
      t.state.credentials.refresh?.(),
      t.state.credentials.refresh?.(),
    ]);
    expect(results).toEqual(['renewed', 'renewed']);
    expect(t.refresh).toHaveBeenCalledOnce();
  });

  it('drops a renewal that finishes after the person signed out', async () => {
    let finish: (outcome: RefreshOutcome) => void = () => undefined;
    const t = renewing({
      credential: null,
      refresh: () => new Promise((resolve) => (finish = resolve)),
    });
    t.state.bootstrap();
    t.state.signIn(renewedGuest('a-1'));
    const renewal = t.state.credentials.refresh?.();
    t.state.signOut();
    finish({ kind: 'renewed', credential: renewedGuest('a-late') });
    await renewal;
    expect(t.state.credentials.currentToken()).toBeNull();
  });

  it('ends the session on the backend when signing out', () => {
    const revoke = vi.fn(() => Promise.resolve());
    const t = renewing({ credential: null, revoke });
    t.state.bootstrap();
    t.state.signIn(renewedGuest('a-1'));
    t.state.signOut();
    expect(revoke).toHaveBeenCalledWith('r-1');
    expect(t.credentials.value).toBeNull();
    expect(t.pending()).toHaveLength(0);
  });

  it('applies a renewal in flight when another tab only rotated the refresh token', async () => {
    let finish: (outcome: RefreshOutcome) => void = () => undefined;
    const t = renewing({ refresh: () => new Promise((resolve) => (finish = resolve)) });
    t.state.bootstrap();
    const renewal = t.state.credentials.refresh?.();

    t.credentials.value = { ...stored, refreshToken: 'r-2' };
    t.state.syncFromStore();
    finish({ kind: 'renewed', credential: renewedGuest('a-1', 'r-2') });

    await expect(renewal).resolves.toBe('renewed');
    expect(t.state.credentials.currentToken()).toBe('a-1');
    expect(t.refresh).toHaveBeenCalledOnce();
  });

  it('never reports as renewed a renewal started for someone else', async () => {
    const finishes: ((outcome: RefreshOutcome) => void)[] = [];
    const t = renewing({ refresh: () => new Promise((resolve) => finishes.push(resolve)) });
    t.state.bootstrap();
    const first = t.state.credentials.refresh?.();

    t.credentials.value = { ...stored, refreshToken: 'r-9', userUUID: 'u-9' };
    t.state.syncFromStore();
    expect(t.refresh).toHaveBeenCalledTimes(2);
    finishes[0]!({ kind: 'renewed', credential: renewedGuest('a-old') });

    await expect(first).resolves.toBe('unavailable');
    expect(t.state.credentials.currentToken()).toBeNull();
    finishes[1]!({
      kind: 'renewed',
      credential: { ...renewedGuest('a-9', 'r-9'), userUUID: 'u-9' },
    });
    await vi.waitFor(() => expect(t.state.credentials.currentToken()).toBe('a-9'));
  });

  it('tries a scheduled renewal again while the backend cannot be reached', async () => {
    let answer: RefreshOutcome = { kind: 'unavailable' };
    const t = renewing({ credential: null, refresh: () => Promise.resolve(answer) });
    t.state.bootstrap();
    t.state.signIn(renewedGuest('a-1', 'r-1', 900_000));
    t.pending()[0]!.run();
    await vi.waitFor(() => expect(t.pending()[0]?.delayMs).toBe(1000));
    t.pending()[0]!.run();
    await vi.waitFor(() => expect(t.pending()[0]?.delayMs).toBe(2000));

    answer = { kind: 'renewed', credential: renewedGuest('a-2', 'r-1', 2_000_000) };
    t.pending()[0]!.run();
    await vi.waitFor(() => expect(t.state.credentials.currentToken()).toBe('a-2'));
    expect(t.pending()[0]!.delayMs).toBe(2_000_000 - 60_000);
  });

  it('never schedules a renewal sooner than a few seconds away', () => {
    const t = renewing({ credential: null });
    t.state.bootstrap();
    t.state.signIn(renewedGuest('a-1', 'r-1', 10_000));
    expect(t.pending()[0]!.delayMs).toBe(5_000);
  });

  it('follows another tab signing out or signing in as someone else', async () => {
    const t = renewing({
      credential: null,
      refresh: () =>
        Promise.resolve({
          kind: 'renewed',
          credential: { ...renewedGuest('a-9', 'r-9'), userUUID: 'u-9' },
        }),
    });
    t.state.bootstrap();
    t.state.signIn(renewedGuest('a-1'));

    t.credentials.value = null;
    t.state.syncFromStore();
    expect(t.state.store.getState().auth).toEqual({ status: 'none' });

    t.credentials.value = { ...stored, refreshToken: 'r-9', userUUID: 'u-9' };
    t.state.syncFromStore();
    await vi.waitFor(() => expect(t.state.credentials.currentToken()).toBe('a-9'));
  });
});
