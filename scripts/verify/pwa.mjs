// The PWA, end to end, against a build served by `apps/web/server.js` (D-020, P01§5).
//
// T-202 established these checks by hand; this is the same walk, written down so the build that
// ships can be re-checked without repeating the reasoning. It must run against a production
// build — there is no service worker in development.
//
//   npm run build -w @playhoot/web          (with PLAYHOOT_SITE_URL set)
//   npm run start -w @playhoot/web          (in another terminal)
//   node scripts/verify/pwa.mjs --base http://localhost:3000
//
// What is deliberately not here: installing on a real Android phone and a real iPhone. No
// emulated browser can answer that; the steps for a person are in T-202's Result.

import process from 'node:process';

import { launchChrome } from './chrome.mjs';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const argument = process.argv[index];
  if (argument.startsWith('--')) args.set(argument.slice(2), process.argv[index + 1]);
}
const base = (args.get('base') ?? 'http://localhost:3000').replace(/\/$/, '');

const failures = [];
const notes = [];
function check(condition, message) {
  if (condition) notes.push(`ok   ${message}`);
  else {
    failures.push(message);
    notes.push(`FAIL ${message}`);
  }
}

const chrome = await launchChrome({ port: 9334, headless: true, windowSize: '1280,900' });
const page = await chrome.newPage();

try {
  // --- the worker registers and precaches exactly one build -------------------------------------
  await page.goto(`${base}/en`);
  await page.waitFor(
    `navigator.serviceWorker.getRegistration('/').then((r) => Boolean(r && r.active))`,
    { tries: 300 },
  );
  const registration = await page.evaluate(
    `navigator.serviceWorker.getRegistration('/').then((r) => ({
       scope: r?.scope ?? null,
       active: Boolean(r?.active),
     }))`,
  );
  check(registration.active, 'the service worker activates');
  check(registration.scope?.endsWith('/'), `its scope is the whole site (${registration.scope})`);

  const caches = await page.evaluate('caches.keys()');
  check(caches.length === 1, `exactly one cache exists for this build (${caches.join(', ')})`);
  check(
    caches.every((name) => name.startsWith('playhoot-')),
    'every cache is one of ours',
  );

  const cached = await page.evaluate(
    `caches.open(${JSON.stringify(caches[0])}).then((c) => c.keys()).then((keys) => keys.map((r) => new URL(r.url).pathname))`,
  );
  for (const path of ['/offline.html', '/site.webmanifest']) {
    check(cached.includes(path), `${path} is precached`);
  }
  check(
    cached.some((path) => path.startsWith('/assets/icons/')),
    'the app icons are precached',
  );
  check(
    cached.every((path) => !path.startsWith('/v1') && !path.startsWith('/admin/v1')),
    'no backend address is in the cache',
  );

  // --- a backend answer is never stored ----------------------------------------------------------
  const beforeApi = cached.length;
  await page.evaluate(`fetch('/v1/identity/login/providers').then(() => null).catch(() => null)`);
  const afterApi = await page.evaluate(
    `caches.open(${JSON.stringify(caches[0])}).then((c) => c.keys()).then((k) => k.length)`,
  );
  check(afterApi === beforeApi, 'a call to /v1 leaves nothing in any cache');

  // --- the manifest is one a browser can install -------------------------------------------------
  const manifest = await page.evaluate(`fetch('/site.webmanifest').then((r) => r.json())`);
  check(
    manifest.display === 'standalone',
    `the manifest asks for its own window (${manifest.display})`,
  );
  check(Boolean(manifest.name && manifest.short_name), 'the manifest names the app');
  check(Boolean(manifest.start_url), `the manifest has a start address (${manifest.start_url})`);
  check(
    Boolean(manifest.theme_color && manifest.background_color),
    'the manifest carries its colours',
  );
  const sizes = (manifest.icons ?? []).map((icon) => icon.sizes);
  check(sizes.includes('192x192'), 'a 192 px icon is declared');
  check(sizes.includes('512x512'), 'a 512 px icon is declared');
  check(
    (manifest.icons ?? []).some((icon) => (icon.purpose ?? '').includes('maskable')),
    'a maskable icon is declared',
  );
  for (const icon of manifest.icons ?? []) {
    const ok = await page.evaluate(
      `fetch(${JSON.stringify(icon.src)}).then((r) => r.ok).catch(() => false)`,
    );
    check(ok, `the icon ${icon.src} is served`);
  }

  // --- no push code, anywhere, ever (P29) ---------------------------------------------------------
  const push = await page.evaluate(
    `navigator.serviceWorker.getRegistration('/').then((r) => r.pushManager.getSubscription()).then((s) => Boolean(s)).catch(() => false)`,
  );
  check(!push, 'nothing has subscribed to push');
  const permission = await page.evaluate(`Notification.permission`);
  check(permission === 'default', `no notification permission was ever asked for (${permission})`);

  // --- the offline page ----------------------------------------------------------------------------
  const offline = await page.evaluate(`fetch('/offline.html').then((r) => r.text())`);
  check(offline.includes('<html'), 'the offline page is a document of its own');
  check(!/<link[^>]+stylesheet/i.test(offline), 'the offline page loads no stylesheet');
  check(
    !/\/assets\/[^"']+\.js/.test(offline),
    'the offline page loads nothing from the build it cannot reach',
  );
  for (const language of ['es', 'en', 'pt-BR']) {
    check(
      offline.includes(`"${language}"`) || offline.includes(`'${language}'`),
      `the offline page carries its ${language} text`,
    );
  }

  // --- the update notice -----------------------------------------------------------------------------
  // A worker that finds a new build waits instead of taking over, so nobody is swapped mid-session.
  const waits = await page.evaluate(
    `navigator.serviceWorker.getRegistration('/').then((r) => ({
       waiting: Boolean(r.waiting),
       hasUpdateHandler: typeof r.onupdatefound !== 'undefined',
     }))`,
  );
  check(!waits.waiting, 'nothing is waiting on a build that has not changed');

  // --- with no network, a navigation shows the offline page ---------------------------------------------
  // The page and the service worker have separate network stacks: cutting only the page off would
  // leave the worker fetching happily and answering with the real site, which is how this check
  // can look like it passes while proving nothing. Both are cut.
  const workerSessions = [];
  chrome.browser.on((message) => {
    if (
      message.method === 'Target.attachedToTarget' &&
      message.params.targetInfo.type === 'service_worker'
    ) {
      workerSessions.push(message.params.sessionId);
    }
  });
  await chrome.browser.send('Target.setAutoAttach', {
    autoAttach: true,
    waitForDebuggerOnStart: false,
    flatten: true,
  });
  await new Promise((resolve) => setTimeout(resolve, 500));
  check(workerSessions.length > 0, 'the running service worker can be cut off the network');
  for (const sessionId of workerSessions) {
    await chrome.browser.send('Network.enable', {}, sessionId);
    await chrome.browser.send(
      'Network.emulateNetworkConditions',
      { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 },
      sessionId,
    );
  }
  await page.setOffline(true);
  await page.goto(`${base}/en/an-address-nothing-cached`);
  await page.waitFor(
    `location.pathname === '/en/an-address-nothing-cached' && document.body.innerText.trim().length > 0`,
    { tries: 200 },
  );
  const offlineShown = await page.evaluate(
    `({ text: document.body.innerText.slice(0, 300), lang: document.documentElement.lang,
        buttons: [...document.querySelectorAll('button, a')]
          .filter((e) => e.getClientRects().length > 0)
          .map((e) => e.textContent.trim()),
        focused: document.activeElement?.textContent?.trim() ?? null })`,
  );
  check(
    offlineShown.buttons.length === 1,
    `the offline page offers one way on, in one language (${offlineShown.buttons.join(' / ')})`,
  );
  check(
    offlineShown.focused === offlineShown.buttons[0],
    `focus is on it (${offlineShown.focused})`,
  );
  check(
    offlineShown.text.length > 20,
    'the offline page says something rather than showing the browser error',
  );
  check(
    ['es', 'en', 'pt-BR'].includes(offlineShown.lang),
    `the offline page picks one language (${offlineShown.lang})`,
  );
  const apiOffline = await page.evaluate(
    `fetch('/v1/identity/login/providers').then(() => 'answered').catch(() => 'failed')`,
  );
  check(
    apiOffline === 'failed',
    'with no network a call to /v1 fails rather than being answered from a cache',
  );
  await page.setOffline(false);
  for (const sessionId of workerSessions) {
    await chrome.browser.send(
      'Network.emulateNetworkConditions',
      { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 },
      sessionId,
    );
  }

  // --- the worker refuses everything it should refuse --------------------------------------------------
  const policy = await page.evaluate(`fetch('/sw.js').then((r) => r.text())`);
  check(/\/v1/.test(policy), 'the worker names the backend prefix it passes through');
  check(!/push|showNotification/i.test(policy), 'the worker contains no push code at all');
} finally {
  await chrome.close();
}

console.log(`PWA check — ${base}\n`);
for (const note of notes) console.log(`  ${note}`);
console.log(
  failures.length === 0
    ? `\nOK: ${notes.length} checks passed. Installing on real devices is still a person's job (CREATOR_TODO P-13).`
    : `\n${failures.length} problem(s).`,
);
process.exit(failures.length === 0 ? 0 : 1);
