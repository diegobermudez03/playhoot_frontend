// Every shareable URL is composed here from backend identifiers (ADR-0002). Changing a path
// here is enough: the backend never knows frontend URLs.

// Where someone without a link types a join code.
export const enterCodePath = '/join';

export const joinPath = (joinCode: string) => `/join/${encodeURIComponent(joinCode)}`;

export const sessionPlayPath = (sessionUUID: string) =>
  `/sessions/${encodeURIComponent(sessionUUID)}/play`;

// Creating a Session (an account's operation): the route creates it and moves to its host screen.
export const newSessionPath = '/sessions/new';
// The same, for a given published game (the host's default game otherwise).
export const newSessionPathFor = (gameUUID: string) =>
  `${newSessionPath}?${new URLSearchParams({ game: gameUUID }).toString()}`;

// The creator's screen of their Session. The join code travels in the URL because the backend
// tells it only when the Session is created; without it the invite uses the Session's link.
export const sessionHostPath = (sessionUUID: string, joinCode?: string | null) =>
  `/sessions/${encodeURIComponent(sessionUUID)}/host` +
  (joinCode ? `?${new URLSearchParams({ code: joinCode }).toString()}` : '');

// The account's own games, each leading to its workspace.
export const myGamesPath = '/games';

// Creating a game (an account's operation): the route creates it and moves to its workspace.
export const newGamePath = '/games/new';

// A game's workspace, where its draft is changed. `section` picks the open section.
export const gameWorkspaceRoute = '/games/:gameUUID/edit';
export const gameWorkspacePath = (gameUUID: string, section?: string) =>
  `/games/${encodeURIComponent(gameUUID)}/edit` +
  (section ? `?${new URLSearchParams({ section }).toString()}` : '');

// The one authentication screen (B, P14§1): it receives why it was opened, the weakest identity
// that would work, and where to continue. The language-independent form; screens link to it
// through `i18n/useLocalePaths.ts`, which puts the reader's language in front.
export const authRoute = '/sign-in';

// Why the screen was opened. The caller names the kind and the screen translates it: a reason is
// never text the caller (or the backend) wrote.
export const authReasons = [
  // No operation behind it: the entry in the top bar.
  'sign-in',
  'join-session',
  'create-session',
  'host-session',
  'create-game',
  'edit-game',
  'my-games',
  'connect-ai',
] as const;
export type AuthReason = (typeof authReasons)[number];

// The weakest identity the operation accepts. `anonymous` never reaches this screen.
export type AuthLevel = 'guest' | 'account';

export interface AuthOptions {
  reason?: AuthReason;
  // The minimum that works; an account when the caller says nothing.
  level?: AuthLevel;
  // Show the account options although a guest would do (the person asked for them).
  account?: boolean;
  next?: string | null;
}

// What the screen was asked for, read back from the URL: the address is the whole input, so a
// copied link reproduces the same screen.
export interface AuthRequest {
  reason: AuthReason;
  level: AuthLevel;
  account: boolean;
  next: string | null;
}

const authAccountValue = 'account';

export function authPath(options: AuthOptions = {}): string {
  const query = new URLSearchParams();
  if (options.reason && options.reason !== 'sign-in') query.set('reason', options.reason);
  if (options.level === 'guest') query.set('level', 'guest');
  if (options.account) query.set('use', authAccountValue);
  if (options.next) query.set('next', options.next);
  const search = query.toString();
  return search ? `${authRoute}?${search}` : authRoute;
}

export function authRequest(search: string, origin?: string): AuthRequest {
  const query = new URLSearchParams(search);
  const reason = query.get('reason');
  const level = query.get('level');
  return {
    // A reason this build does not know is no reason at all: the screen still works.
    reason: isAuthReason(reason) ? reason : 'sign-in',
    // Anything but the explicit `guest` asks for an account: the stricter answer is the safe one.
    level: level === 'guest' ? 'guest' : 'account',
    account: query.get('use') === authAccountValue,
    next: origin === undefined ? safeNext(search) : safeNext(search, origin),
  };
}

function isAuthReason(value: string | null): value is AuthReason {
  return value !== null && (authReasons as readonly string[]).includes(value);
}

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

// Where an AI app sends the person to approve its connection (OAuth consent). `request` is the
// authorization request's id, as the backend gives it to the AI app.
export const connectAiRoute = '/connect-ai';

// The account's connected AI apps, each revocable.
export const aiConnectionsPath = '/account/ai-connections';
