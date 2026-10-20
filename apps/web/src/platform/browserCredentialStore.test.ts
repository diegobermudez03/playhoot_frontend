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
  it('round-trips a credential', () => {
    const store = createBrowserCredentialStore(fakeStorage());
    store.save({ token: 't', userUUID: 'u', kind: 'guest' });
    expect(store.load()).toEqual({ token: 't', userUUID: 'u', kind: 'guest' });
    store.clear();
    expect(store.load()).toBeNull();
  });

  it('ignores corrupt or foreign content', () => {
    const storage = fakeStorage();
    const store = createBrowserCredentialStore(storage);
    storage.setItem('playhoot.credential.v1', '{not json');
    expect(store.load()).toBeNull();
    storage.setItem(
      'playhoot.credential.v1',
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
