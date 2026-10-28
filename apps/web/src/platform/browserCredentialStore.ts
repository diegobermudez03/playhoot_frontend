import type { Credential, CredentialStore } from '@playhoot/app-core';

// v2: credentials with a refresh token (backend IDENTITY-ADR-0003). Anything stored under v1 was
// the placeholder backend's fixed guest, which no longer authenticates, so it is left behind.
export const credentialStorageKey = 'playhoot.credential.v2';

// Browser persistence of the credential. A credential with a refresh token is stored without its
// access token, which lives only in memory and is renewed from the refresh token on the next load.
// Storage can be unavailable (private mode, blocked site data) or hold anything, so every read is
// validated and every failure degrades to "no credential".
export function createBrowserCredentialStore(
  storage: Storage | undefined = safeLocalStorage(),
): CredentialStore {
  return {
    load() {
      try {
        const raw = storage?.getItem(credentialStorageKey);
        return raw ? parseCredential(JSON.parse(raw)) : null;
      } catch {
        return null;
      }
    },
    save(credential) {
      try {
        const { token, expiresAt, ...kept } = credential;
        storage?.setItem(
          credentialStorageKey,
          JSON.stringify(credential.refreshToken ? kept : { ...kept, token, expiresAt }),
        );
      } catch {
        // Not persisted: the credential still lives in memory for this page.
      }
    },
    clear() {
      try {
        storage?.removeItem(credentialStorageKey);
      } catch {
        // Nothing to clear.
      }
    },
  };
}

function parseCredential(value: unknown): Credential | null {
  if (typeof value !== 'object' || value === null) return null;
  const { token, refreshToken, userUUID, kind, displayName } = value as Record<string, unknown>;
  if (typeof userUUID !== 'string' || !userUUID) return null;
  if (kind !== 'guest' && kind !== 'account') return null;
  const credential: Credential = { token: '', userUUID, kind };
  if (typeof refreshToken === 'string' && refreshToken) credential.refreshToken = refreshToken;
  else if (typeof token === 'string' && token) credential.token = token;
  else return null;
  if (typeof displayName === 'string' && displayName) credential.displayName = displayName;
  return credential;
}

function safeLocalStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
