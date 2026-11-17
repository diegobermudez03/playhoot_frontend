import { marketFunctions, type MarketFunction } from '@playhoot/protocol';

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

// The same screen with what was already typed in its address, so a trip away from it — to the
// residence-and-age declaration a gated function asks for — comes back to all of it
// (WCAG 2.2 3.3.7).
export function newGamePathWith(name: string, template: { gameUUID: string; name: string } | null) {
  const query = new URLSearchParams();
  if (name) query.set('name', name);
  if (template) {
    query.set('template', template.gameUUID);
    query.set('templateName', template.name);
  }
  const search = query.toString();
  return search ? `${newGamePath}?${search}` : newGamePath;
}

// What that screen was left with, read back from its address.
export function newGameRequest(search: string): {
  name: string;
  template: { gameUUID: string; name: string } | null;
} {
  const query = new URLSearchParams(search);
  const template = query.get('template');
  return {
    name: query.get('name') ?? '',
    template: template ? { gameUUID: template, name: query.get('templateName') ?? '' } : null,
  };
}

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
  // Teaching with Playhoot: the home band and the shell's mode switch ask for an account first.
  'teach',
  // The profile and its subscreens, which a guest may reach but an account owns.
  'profile',
  // The admin area asks for an account before its own second factor (D-023).
  'admin',
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

// The person's own corner: who they are, and the doors to methods, legal, notifications and
// deletion. Personal addresses carry no language and are never offered to crawlers.
export const profilePaths = {
  home: '/profile',
  methods: '/profile/methods',
  legal: '/profile/legal',
  delete: '/profile/delete',
} as const;

// What `/profile/methods` was told about a provider round trip that has just come back, read
// from its address: the identity became another way in, or it is another account's way in and
// matching addresses never merge (P03§11).
export const methodLinkOutcomes = ['linked', 'in-use'] as const;
export type MethodLinkOutcome = (typeof methodLinkOutcomes)[number];

export function methodsPathWith(outcome: MethodLinkOutcome): string {
  return `${profilePaths.methods}?${new URLSearchParams({ linked: outcome }).toString()}`;
}

export function methodLinkOutcome(search: string): MethodLinkOutcome | null {
  const value = new URLSearchParams(search).get('linked');
  return value !== null && (methodLinkOutcomes as readonly string[]).includes(value)
    ? (value as MethodLinkOutcome)
    : null;
}

// Where teacher mode lands until H8 builds teaching (D-034).
export const teacherPath = '/teacher';

// The notification history the bell panel abbreviates, and the email preferences behind it.
// Personal addresses, so no language in the path.
export const notificationPaths = {
  history: '/notifications',
  preferences: '/notifications/preferences',
} as const;

// The contextual residence-and-age declaration (D-038): a gated function refuses, and the person
// is sent here the same way a missing account sends them to the sign-in screen. Its address is
// its whole input, so a copied link reproduces the screen.
export const declarationRoute = '/declaration';

// What the declaration screen was asked for, read back from its address.
export interface DeclarationRequest {
  // The function that asked, as a kind this screen translates; null when it named one this
  // build does not know, which changes nothing about what is asked.
  function: MarketFunction | null;
  next: string | null;
}

export function declarationScreenPath(marketFunction: string | null, next?: string | null): string {
  const query = new URLSearchParams();
  if (marketFunction) query.set('function', marketFunction);
  if (next) query.set('next', next);
  const search = query.toString();
  return search ? `${declarationRoute}?${search}` : declarationRoute;
}

export function declarationRequest(search: string, origin?: string): DeclarationRequest {
  const asked = new URLSearchParams(search).get('function');
  return {
    function: isMarketFunction(asked) ? asked : null,
    next: origin === undefined ? safeNext(search) : safeNext(search, origin),
  };
}

function isMarketFunction(value: string | null): value is MarketFunction {
  return value !== null && (marketFunctions as readonly string[]).includes(value);
}

// Where an AI app sends the person to approve its connection (OAuth consent). `request` is the
// authorization request's id, as the backend gives it to the AI app.
export const connectAiRoute = '/connect-ai';

// The account's connected AI apps, each revocable.
export const aiConnectionsPath = '/account/ai-connections';

// The admin area (D-023). Its addresses carry no language: it is the administrator's own area,
// framed by nothing of the public app, and it is never linked from the public shell.
export const adminPaths = {
  home: '/admin',
  signIn: '/admin/sign-in',
  secondFactor: '/admin/second-factor',
  queues: '/admin/queues',
  budget: '/admin/budget',
  email: '/admin/email',
} as const;

// Where to send someone whose admin mode is not open (or has just lapsed), so that signing in
// again brings them back to the panel they were on, with everything its address carried.
export function adminSignInPath(next?: string | null): string {
  return next
    ? `${adminPaths.signIn}?${new URLSearchParams({ next }).toString()}`
    : adminPaths.signIn;
}

// Whether an address belongs to the admin area, which frames itself.
export function isAdminPath(pathname: string): boolean {
  return pathname === adminPaths.home || pathname.startsWith(`${adminPaths.home}/`);
}

// Public pages that show their own big logo, so the bar must not repeat it. They are
// server-rendered, and the bar is drawn before a screen could ask: reading the address is how it
// is right the first time rather than one frame later (the same reason as `isAdminPath`).
export function isBarePublicPath(pathname: string): boolean {
  const rest = pathname.replace(/^\/(es|en|pt)(?=\/|$)/, '');
  return rest === enterCodePath;
}
