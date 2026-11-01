import type { AuthSnapshot } from '@playhoot/app-core';

// Who the pages are for: the person's user, or no one known. It changes only when the person
// changes (signed in or out, here or in another tab), never when their credential is renewed or a
// guest becomes an account, so keying the pages on it closes the previous person's live
// connections and data and rebuilds them for the new one.
export function identityKey(auth: AuthSnapshot): string {
  return auth.status === 'guest' || auth.status === 'authenticated'
    ? `user:${auth.userUUID}`
    : auth.status;
}
