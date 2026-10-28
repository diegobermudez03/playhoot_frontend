import { describe, expect, it } from 'vitest';

import { createBrowserCredentialStore } from './browserCredentialStore';

function fakeStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, v),
  };
}

describe('createBrowserCredentialStore', () => {
  it('keeps a refresh token but never the access token it renews', () => {
    const storage = fakeStorage();
    const store = createBrowserCredentialStore(storage);
    store.save({
      token: 'a',
      refreshToken: 'r',
      expiresAt: 5,
      userUUID: 'u',
      kind: 'guest',
      displayName: 'Ana',
    });
    expect(storage.getItem('playhoot.credential.v2')).not.toContain('"token"');
    expect(store.load()).toEqual({
      token: '',
      refreshToken: 'r',
      userUUID: 'u',
      kind: 'guest',
      displayName: 'Ana',
    });
    store.clear();
    expect(store.load()).toBeNull();
  });

  it('keeps the token of a credential without refresh token (development test accounts)', () => {
    const store = createBrowserCredentialStore(fakeStorage());
    store.save({ token: 'test-user-1', userUUID: 'u', kind: 'account' });
    expect(store.load()).toEqual({ token: 'test-user-1', userUUID: 'u', kind: 'account' });
  });

  it('leaves the old placeholder credential behind', () => {
    const storage = fakeStorage();
    storage.setItem(
      'playhoot.credential.v1',
      JSON.stringify({ token: 'test-guest', userUUID: 'u', kind: 'guest' }),
    );
    expect(createBrowserCredentialStore(storage).load()).toBeNull();
  });

  it('ignores corrupt or foreign content', () => {
    const storage = fakeStorage();
    const store = createBrowserCredentialStore(storage);
    storage.setItem('playhoot.credential.v2', '{not json');
    expect(store.load()).toBeNull();
    storage.setItem(
      'playhoot.credential.v2',
      JSON.stringify({ token: 't', userUUID: 'u', kind: 'admin' }),
    );
    expect(store.load()).toBeNull();
  });

  it('degrades to no credential when storage is unavailable or throws', () => {
    expect(createBrowserCredentialStore(undefined).load()).toBeNull();
    const throwing = {
      ...fakeStorage(),
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    const store = createBrowserCredentialStore(throwing);
    expect(() => store.save({ token: 't', userUUID: 'u', kind: 'guest' })).not.toThrow();
    expect(store.load()).toBeNull();
  });
});
