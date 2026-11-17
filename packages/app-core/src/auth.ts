import type { Credential } from './credentials';

// Local knowledge of who the app is acting as. It drives UX and navigation only; it never grants
// anything, and a backend 401/403 wins over it.
export type AuthSnapshot =
  | { status: 'unknown' }
  | { status: 'none' }
  | { status: 'guest'; userUUID: string; displayName: string | null; mode: string }
  | { status: 'authenticated'; userUUID: string; displayName: string | null; mode: string };

export function authSnapshotOf(credential: Credential | null): AuthSnapshot {
  if (!credential) return { status: 'none' };
  const identity = {
    userUUID: credential.userUUID,
    displayName: credential.displayName ?? null,
    // Every credential the backend issues says which face of the account it is for, so the mode
    // survives a reload without asking anything (D-040).
    mode: credential.mode || 'normal',
  };
  return credential.kind === 'guest'
    ? { status: 'guest', ...identity }
    : { status: 'authenticated', ...identity };
}
