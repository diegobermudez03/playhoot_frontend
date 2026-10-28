// Every shareable URL is composed here from backend identifiers (ADR-0002). Changing a path
// here is enough: the backend never knows frontend URLs.

// Where someone without a link types a join code.
export const enterCodePath = '/join';

export const joinPath = (joinCode: string) => `/join/${encodeURIComponent(joinCode)}`;

export const sessionPlayPath = (sessionUUID: string) =>
  `/sessions/${encodeURIComponent(sessionUUID)}/play`;

// Signing in or registering with an account: the definitive route. `next` is where to continue.
export const signInRoute = '/sign-in';
// Playing as a guest, with the account option. Only for operations that allow guests.
export const guestSignInRoute = '/sign-in/guest';

export const signInPath = (next?: string) => withNext(signInRoute, next);
export const guestSignInPath = (next?: string) => withNext(guestSignInRoute, next);

// The `next` a sign-in route was given, if it is a path of this app. Anything else (another site,
// a protocol-relative URL) is dropped, so a crafted link cannot send someone away after signing in.
export function safeNext(search: string): string | null {
  const next = new URLSearchParams(search).get('next');
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return null;
  return next;
}

// The join code inside a `next` that opens a join link, to tell the person what they are joining.
export function joinCodeOf(next: string | null): string | null {
  const match = next?.match(/^\/join\/([^/?#]+)$/);
  return match ? decodeURIComponent(match[1]!).toUpperCase() : null;
}

function withNext(path: string, next: string | undefined): string {
  return next ? `${path}?${new URLSearchParams({ next }).toString()}` : path;
}
