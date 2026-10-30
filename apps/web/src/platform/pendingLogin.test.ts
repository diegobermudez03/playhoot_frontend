import { describe, expect, it } from 'vitest';

import {
  createBrowserPendingLoginStore,
  loginChallengeOf,
  newLoginVerifier,
  sha256,
} from './pendingLogin';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  };
}

describe('createBrowserPendingLoginStore', () => {
  it('gives the pending sign-in back once', () => {
    const store = createBrowserPendingLoginStore(memoryStorage());
    store.save({ verifier: 'v', next: '/sessions/new', startedAt: 5 });

    expect(store.take()).toEqual({ verifier: 'v', next: '/sessions/new', startedAt: 5 });
    expect(store.take()).toBeNull();
  });

  it('ignores anything it did not write', () => {
    const storage = memoryStorage();
    storage.setItem('playhoot.pendingLogin.v1', '{"verifier":3}');
    expect(createBrowserPendingLoginStore(storage).take()).toBeNull();
    expect(createBrowserPendingLoginStore(undefined).take()).toBeNull();
  });
});

const hex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

describe('PKCE', () => {
  it('makes the S256 challenge (value from Python hashlib)', async () => {
    await expect(loginChallengeOf('a-verifier-of-the-right-shape-0123456789abc')).resolves.toBe(
      'c_79Hoalyy-j9GIRVIVwbOGssjfDehhTA_jflUUP3To',
    );
    expect(newLoginVerifier()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('hashes in script like the published vectors and the platform', async () => {
    const encode = (text: string) => new TextEncoder().encode(text);
    expect(hex(sha256(encode('')))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
    expect(hex(sha256(encode('abc')))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    for (const input of ['x'.repeat(55), 'y'.repeat(56), 'z'.repeat(200), 'ñandú']) {
      const platform = new Uint8Array(await crypto.subtle.digest('SHA-256', encode(input)));
      expect(hex(sha256(encode(input)))).toBe(hex(platform));
    }
  });
});
