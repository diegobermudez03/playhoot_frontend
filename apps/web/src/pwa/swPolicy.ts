// What the service worker does with a request, decided without touching any browser global so it
// can be read and tested on its own (D-020).
//
// The one rule that matters: the worker writes to its caches only what this file calls
// `precache` or `immutable`. Nothing else is ever stored, so a backend answer — or a URL carrying
// a sign-in's one-time code — cannot end up in a cache by any path.

// Everything the backend answers. The worker does not even look at these requests.
export const apiPathPrefixes = ['/v1', '/admin/v1'] as const;

// The build writes files whose name carries a hash of their content; a name therefore identifies
// one exact body forever. Same rule as the host's static handler (`apps/web/server.js`).
const contentHashedName = /-[A-Za-z0-9_-]{8,}\.[a-z0-9]+$/;

export type Strategy =
  // Not the worker's business: it does not answer, the browser goes to the network as usual.
  | 'bypass'
  // Network first, the offline page when the network fails. The answer is never stored.
  | 'navigate'
  // Served from the cache when it is there, fetched and stored when it is not.
  | 'immutable'
  // Part of the installed shell: cache first, network as a fallback. Never stored at runtime.
  | 'precached';

export interface RequestFacts {
  // 'GET', 'POST', …
  readonly method: string;
  // The request's mode: 'navigate' for a page the person is going to.
  readonly mode: string;
  // The absolute URL being requested.
  readonly url: string;
  // The origin the worker itself was served from.
  readonly origin: string;
  // Present when the request is a protocol upgrade (a WebSocket handshake).
  readonly upgrade?: string | null;
}

export function isApiPath(pathname: string): boolean {
  return apiPathPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isContentHashed(pathname: string): boolean {
  return contentHashedName.test(pathname);
}

export function strategyFor(facts: RequestFacts, precached: ReadonlySet<string>): Strategy {
  if (facts.method !== 'GET') return 'bypass';
  if (facts.upgrade) return 'bypass';

  let url: URL;
  try {
    url = new URL(facts.url);
  } catch {
    return 'bypass';
  }
  // Another site's address: the game frame, a provider's sign-in, a font. Not ours to serve.
  if (url.origin !== facts.origin) return 'bypass';
  if (isApiPath(url.pathname)) return 'bypass';

  if (facts.mode === 'navigate') return 'navigate';
  if (precached.has(url.pathname)) return 'precached';
  if (isContentHashed(url.pathname)) return 'immutable';
  return 'bypass';
}

// The cache a build owns. Activating a new build deletes every cache whose name is this shape but
// not this one, so a browser never keeps two builds' files.
export const cacheNamePrefix = 'playhoot-';

export function cacheNameFor(build: string): string {
  return `${cacheNamePrefix}${build}`;
}

export function cachesToDelete(existing: readonly string[], keep: string): string[] {
  return existing.filter((name) => name.startsWith(cacheNamePrefix) && name !== keep);
}
