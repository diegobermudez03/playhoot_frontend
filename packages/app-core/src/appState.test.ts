import { describe, expect, it } from 'vitest';

import { createAppState } from './appState';
import type { Credential, CredentialStore } from './credentials';

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

const guest: Credential = { token: 't-guest', userUUID: 'u-1', kind: 'guest' };

describe('createAppState', () => {
  it('starts unknown and resolves from the persisted credential on bootstrap', () => {
    const app = createAppState(memoryStore(guest));
    expect(app.store.getState().auth).toEqual({ status: 'unknown' });
    expect(app.credentials.currentToken()).toBeNull();

    app.bootstrap();

    expect(app.store.getState().auth).toEqual({ status: 'guest', userUUID: 'u-1' });
    expect(app.credentials.currentToken()).toBe('t-guest');
  });

  it('resolves to none when nothing is persisted', () => {
    const app = createAppState(memoryStore());
    app.bootstrap();
    expect(app.store.getState().auth).toEqual({ status: 'none' });
  });

  it('persists on sign in and forgets on sign out', () => {
    const persisted = memoryStore();
    const app = createAppState(persisted);
    app.bootstrap();

    app.signIn({ token: 't-acc', userUUID: 'u-2', kind: 'account' });
    expect(persisted.value?.token).toBe('t-acc');
    expect(app.store.getState().auth).toEqual({ status: 'authenticated', userUUID: 'u-2' });

    app.signOut();
    expect(persisted.value).toBeNull();
    expect(app.credentials.currentToken()).toBeNull();
    expect(app.store.getState().auth).toEqual({ status: 'none' });
  });
});
