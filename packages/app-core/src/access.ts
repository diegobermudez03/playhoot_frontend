import type { AuthSnapshot } from './auth';

// How strongly the person is authenticated, weakest first. The backend's operation catalog says the
// minimum level each operation requires (backend IDENTITY-ADR-0003).
export const accessLevels = ['anonymous', 'guest', 'account'] as const;
export type AccessLevel = (typeof accessLevels)[number];

// The backend's catalog: each operation's required level as the backend wrote it.
export type OperationCatalog =
  { status: 'loading' } | { status: 'ready'; requirements: ReadonlyMap<string, string> };

// What the person may do about an operation. Guidance for the UI only: the backend still decides.
export type OperationAccess =
  // The identity or the catalog is still being resolved.
  | { status: 'pending' }
  | { status: 'allowed' }
  // Authenticate first, at least as `level`: a guest when the operation allows guests.
  | { status: 'needs'; level: Exclude<AccessLevel, 'anonymous'> };

export function accessLevelOf(auth: AuthSnapshot): AccessLevel | null {
  switch (auth.status) {
    case 'unknown':
      return null;
    case 'none':
      return 'anonymous';
    case 'guest':
      return 'guest';
    case 'authenticated':
      return 'account';
  }
}

// The level an operation requires. An operation the catalog does not list, or a level this client
// does not know, counts as the strongest known level (backend-contract-values.md).
export function requiredLevel(
  catalog: ReadonlyMap<string, string>,
  operation: string,
): AccessLevel {
  const level = catalog.get(operation);
  return level !== undefined && isAccessLevel(level) ? level : 'account';
}

export function operationAccess(
  auth: AuthSnapshot,
  catalog: OperationCatalog,
  operation: string,
): OperationAccess {
  const have = accessLevelOf(auth);
  if (have === null || catalog.status === 'loading') return { status: 'pending' };
  const need = requiredLevel(catalog.requirements, operation);
  if (accessLevels.indexOf(have) >= accessLevels.indexOf(need)) return { status: 'allowed' };
  return { status: 'needs', level: need === 'account' ? 'account' : 'guest' };
}

function isAccessLevel(value: string): value is AccessLevel {
  return (accessLevels as readonly string[]).includes(value);
}
