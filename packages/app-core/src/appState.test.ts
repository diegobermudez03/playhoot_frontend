import { describe, expect, it } from 'vitest';

import { createAppState } from './appState';
import type { Credential, CredentialStore } from './credentials';
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
