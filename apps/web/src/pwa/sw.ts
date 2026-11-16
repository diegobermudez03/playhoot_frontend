// The service worker (D-020). Built from this file by the `playhoot-pwa` plugin
// (`apps/web/vite-pwa.ts`), which fills in the build's identity, the files that make up its shell
// and the address of the offline page, and writes the result to `build/client/sw.js`.
//
// What it does: serves the installed shell and the build's content-hashed files from a cache, and
// shows a plain offline page when a navigation cannot reach the network. What it never does:
// touch a backend answer, store a navigation (a sign-in's one-time code travels in one), or ask
// for any permission. There is no push code here and there never will be (P29).
import { cacheNameFor, cachesToDelete, strategyFor } from './swPolicy';

// Filled in at build time.
declare const __PLAYHOOT_BUILD__: string;
declare const __PLAYHOOT_PRECACHE__: readonly string[];
declare const __PLAYHOOT_OFFLINE_PAGE__: string;

// `self` in a service worker is a ServiceWorkerGlobalScope; the standard library types it as the
// worker scope every kind of worker shares.
const sw = self as unknown as ServiceWorkerGlobalScope;

const cacheName = cacheNameFor(__PLAYHOOT_BUILD__);
const precached = new Set(__PLAYHOOT_PRECACHE__);

// The page asks for the waiting worker to take over when the person accepts the update notice.
export const skipWaitingMessage = 'playhoot-skip-waiting';

sw.addEventListener('install', (event) => {
  // No `skipWaiting()`: a new build waits until the person accepts the notice or navigates away,
  // so a running session is never swapped under the people in it.
  event.waitUntil(installShell());
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(activate());
});

sw.addEventListener('message', (event) => {
  if (event.data === skipWaitingMessage) void sw.skipWaiting();
});

sw.addEventListener('fetch', (event) => {
  const strategy = strategyFor(
    {
      method: event.request.method,
      mode: event.request.mode,
      url: event.request.url,
      origin: sw.location.origin,
      upgrade: event.request.headers.get('upgrade'),
    },
    precached,
  );
  // Not answering leaves the request exactly as it would be without a worker.
  if (strategy === 'bypass') return;
  if (strategy === 'navigate') return event.respondWith(navigate(event.request));
  event.respondWith(fromCacheFirst(event.request, strategy === 'immutable'));
});

async function installShell(): Promise<void> {
  const cache = await caches.open(cacheName);
  // `reload` so a shell file is taken from the network and not from the browser's own HTTP cache.
  await cache.addAll(
    [...precached].map(
      (path) => new Request(path, { cache: 'reload', credentials: 'same-origin' }),
    ),
  );
}

async function activate(): Promise<void> {
  const names = await caches.keys();
  await Promise.all(cachesToDelete(names, cacheName).map((name) => caches.delete(name)));
  await sw.clients.claim();
}

// A page: the network decides, and nothing is stored. When there is no network, the offline page
// explains it and offers to try again.
async function navigate(request: Request): Promise<Response> {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(cacheName);
    const offline = await cache.match(__PLAYHOOT_OFFLINE_PAGE__);
    return offline ?? new Response('', { status: 504, statusText: 'Offline' });
  }
}

// A file of the shell, or one whose name carries the hash of its content: the cache is as good as
// the network and works without it.
async function fromCacheFirst(request: Request, store: boolean): Promise<Response> {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request, { ignoreSearch: false });
  if (hit) return hit;
  const response = await fetch(request);
  // Only our own, complete answers are kept; an error or a partial body is not a shell file.
  if (store && response.ok && response.type === 'basic') {
    await cache.put(request, response.clone());
  }
  return response;
}
