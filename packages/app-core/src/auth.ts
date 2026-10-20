import type { Credential } from './credentials';

// Local knowledge of who the app is acting as. It drives UX and navigation only; it never grants
// anything, and a backend 401/403 wins over it.
export type AuthSnapshot =
  | { status: 'unknown' }
  | { status: 'none' }
  | { status: 'guest'; userUUID: string }
  | { status: 'authenticated'; userUUID: string };

export function authSnapshotOf(credential: Credential | null): AuthSnapshot {
  if (!credential) return { status: 'none' };
  return credential.kind === 'guest'
    ? { status: 'guest', userUUID: credential.userUUID }
    : { status: 'authenticated', userUUID: credential.userUUID };
}
