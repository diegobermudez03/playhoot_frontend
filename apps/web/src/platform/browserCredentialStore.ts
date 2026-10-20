import type { Credential, CredentialStore } from '@playhoot/app-core';

const storageKey = 'playhoot.credential.v1';

// Browser persistence of the credential. Storage can be unavailable (private mode, blocked site
// data) or hold anything, so every read is validated and every failure degrades to "no credential".
export function createBrowserCredentialStore(
  storage: Storage | undefined = safeLocalStorage(),
): CredentialStore {
  return {
    load() {
      try {
        const raw = storage?.getItem(storageKey);
        return raw ? parseCredential(JSON.parse(raw)) : null;
      } catch {
        return null;
      }
    },
    save(credential) {
      try {
        storage?.setItem(storageKey, JSON.stringify(credential));
      } catch {
        // Not persisted: the credential still lives in memory for this page.
      }
    },
    clear() {
      try {
        storage?.removeItem(storageKey);
      } catch {
        // Nothing to clear.
      }
    },
  };
}

function parseCredential(value: unknown): Credential | null {
  if (typeof value !== 'object' || value === null) return null;
  const { token, userUUID, kind } = value as Record<string, unknown>;
  if (typeof token !== 'string' || !token || typeof userUUID !== 'string' || !userUUID) return null;
  if (kind !== 'guest' && kind !== 'account') return null;
  return { token, userUUID, kind };
}

function safeLocalStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
