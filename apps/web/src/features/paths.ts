// Every shareable URL is composed here from backend identifiers (ADR-0002). Changing a path
// here is enough: the backend never knows frontend URLs.

// Where someone without a link types a join code.
export const enterCodePath = '/join';

export const joinPath = (joinCode: string) => `/join/${encodeURIComponent(joinCode)}`;

export const sessionPlayPath = (sessionUUID: string) =>
  `/sessions/${encodeURIComponent(sessionUUID)}/play`;

// Creating a Session (an account's operation): the route creates it and moves to its host screen.
export const newSessionPath = '/sessions/new';

// The creator's screen of their Session. The join code travels in the URL because the backend
// tells it only when the Session is created; without it the invite uses the Session's link.
export const sessionHostPath = (sessionUUID: string, joinCode?: string | null) =>
  `/sessions/${encodeURIComponent(sessionUUID)}/host` +
  (joinCode ? `?${new URLSearchParams({ code: joinCode }).toString()}` : '');

// Signing in or registering with an account: the definitive route. `next` is where to continue.
export const signInRoute = '/sign-in';
// Playing as a guest, with the account option. Only for operations that allow guests.
export const guestSignInRoute = '/sign-in/guest';

export const signInPath = (next?: string) => withNext(signInRoute, next);
export const guestSignInPath = (next?: string) => withNext(guestSignInRoute, next);

// The `next` a sign-in route was given, if it is a path of this app. Anything else (another site,
// a protocol-relative URL) is dropped, so a crafted link cannot send someone away after signing in.
export function safeNext(search: string, origin: string = window.location.origin): string | null {
  const next = new URLSearchParams(search).get('next');
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return null;
  // URL parsing drops control characters (a tab, a newline), which could turn "/<tab>/x" into
  // "//x": refuse them, and require the result to stay on this origin.
  if ([...next].some((char) => char.charCodeAt(0) < 0x20 || char.charCodeAt(0) === 0x7f))
    return null;
  try {
    return new URL(next, origin).origin === origin ? next : null;
  } catch {
    return null;
  }
}

// The join code inside a `next` that opens a join link, to tell the person what they are joining.
export function joinCodeOf(next: string | null): string | null {
  const match = next?.match(/^\/join\/([^/?#]+)$/);
  return match ? decodeURIComponent(match[1]!).toUpperCase() : null;
}

function withNext(path: string, next: string | undefined): string {
  return next ? `${path}?${new URLSearchParams({ next }).toString()}` : path;
}
