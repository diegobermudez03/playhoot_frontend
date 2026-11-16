// WCAG 2.2 AA, audited automatically on the running app (P14§3).
//
// An automated audit does not prove a screen is usable; it proves that the machine-checkable part
// of the standard is clean, which is the part a person should never have to re-check by hand. The
// keyboard pass, the focus order and anything about meaning stay a human job, and the task that
// runs this writes down what it checked by hand beside the output.
//
//   node scripts/verify/a11y.mjs --base http://localhost:5173
//   node scripts/verify/a11y.mjs --base ... --totp-secret <base32>   # also the admin panels
//        (--account <name> names the administrator at the local provider; default T207Operator)
//   node scripts/verify/a11y.mjs --base ... --urls /en,/en/join
//
// axe-core is fetched from the registry into `node_modules/.cache/` the first time and reused; it
// is not a dependency of this workspace, because nothing but this script uses it and the audit is
// run by a person looking at the result, not by `npm run check`.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import { launchChrome } from './chrome.mjs';

const AXE_VERSION = '4.14.1';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const argument = process.argv[index];
  if (argument.startsWith('--')) args.set(argument.slice(2), process.argv[index + 1]);
}
const base = (args.get('base') ?? 'http://localhost:5173').replace(/\/$/, '');
const totpSecret = args.get('totp-secret') ?? process.env.PLAYHOOT_ADMIN_TOTP_SECRET ?? null;
// The administrator's name at the fictitious local provider, used only with --totp-secret.
const account = args.get('account') ?? 'T207Operator';
const localProviderLabel = args.get('local-provider') ?? 'Local test account';

// The screens H2 delivers. The public ones answer to anybody; the admin panels need admin mode,
// which `--totp-secret` buys.
const publicPages = [
  { url: '/en', name: 'home (en)' },
  { url: '/es', name: 'home (es)' },
  { url: '/pt', name: 'home (pt-BR)' },
  { url: '/en/join', name: 'join entry' },
  {
    url: '/en/sign-in?reason=join-session&level=guest&next=%2Fjoin%2FABC234',
    name: 'contextual sign-in (a guest will do)',
  },
  {
    url: '/en/sign-in?reason=create-game&level=account&next=%2Fgames%2Fnew',
    name: 'contextual sign-in (an account is required)',
  },
  { url: '/admin/sign-in', name: 'admin sign-in' },
  { url: '/admin/second-factor', name: 'admin second factor' },
];
const adminPages = [
  { url: '/admin', name: 'admin overview' },
  { url: '/admin/queues', name: 'admin queues and dead tasks' },
  { url: '/admin/budget', name: 'admin budget' },
  { url: '/admin/email', name: 'admin email' },
];

const chosen = args.get('urls')
  ? args
      .get('urls')
      .split(',')
      .map((url) => ({ url, name: url }))
  : publicPages;

// --- axe-core ----------------------------------------------------------------------------------

function axeSource() {
  const cache = path.join(root, 'node_modules', '.cache', 'axe-core');
  const file = path.join(cache, `axe-${AXE_VERSION}.min.js`);
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
  fs.mkdirSync(cache, { recursive: true });
  const installed = path.join(root, 'node_modules', 'axe-core', 'axe.min.js');
  if (fs.existsSync(installed)) {
    fs.copyFileSync(installed, file);
    return fs.readFileSync(file, 'utf8');
  }
  console.log(`Fetching axe-core ${AXE_VERSION} into node_modules/.cache ...`);
  const tarball = execFileSync(
    'npm',
    ['pack', `axe-core@${AXE_VERSION}`, '--pack-destination', cache, '--silent'],
    { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' },
  )
    .trim()
    .split('\n')
    .pop();
  fs.writeFileSync(file, readFromTarball(path.join(cache, tarball), 'package/axe.min.js'));
  fs.rmSync(path.join(cache, tarball), { force: true });
  return fs.readFileSync(file, 'utf8');
}

// One file out of a .tgz. `tar` is not used: on Windows it reads `C:\...` as a remote host, and a
// tar archive is 512-byte headers followed by 512-byte-aligned contents, which is less code than
// working around that.
function readFromTarball(tarball, wanted) {
  const archive = gunzipSync(fs.readFileSync(tarball));
  for (let offset = 0; offset + 512 <= archive.length;) {
    const name = archive.toString('utf8', offset, offset + 100).replace(/\0.*$/, '');
    if (!name) break;
    const size = parseInt(archive.toString('utf8', offset + 124, offset + 136).trim(), 8) || 0;
    const start = offset + 512;
    if (name === wanted) return archive.subarray(start, start + size);
    offset = start + Math.ceil(size / 512) * 512;
  }
  throw new Error(`${wanted} is not in ${tarball}`);
}

// Everything the standard calls A or AA, up to 2.2. Nothing is switched off: a rule that does not
// apply to a screen simply reports nothing.
const axeOptions = {
  runOnly: {
    type: 'tag',
    values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'],
  },
  resultTypes: ['violations', 'incomplete'],
};

// --- the one-time code, for admin mode ----------------------------------------------------------

async function totp(secretBase32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = secretBase32.replace(/[\s=]/g, '').toUpperCase();
  let bits = '';
  for (const character of clean) {
    const value = alphabet.indexOf(character);
    if (value < 0) throw new Error(`"${character}" is not base32`);
    bits += value.toString(2).padStart(5, '0');
  }
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map((byte) => parseInt(byte, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000 / 30)));
  const { createHmac } = await import('node:crypto');
  const digest = createHmac('sha1', key).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(code % 1_000_000).padStart(6, '0');
}

// --- running ------------------------------------------------------------------------------------

const axe = axeSource();
const chrome = await launchChrome({ port: 9333, headless: true, windowSize: '1280,900' });
const page = await chrome.newPage();
await page.resize(1280, 900);

const results = [];

async function audit({ url, name, within = false }) {
  if (within) {
    // Admin mode is a token in memory (D-031): reloading the page ends it and the next panel
    // would be the sign-in screen wearing the panel's name in this report. Inside the admin area
    // the audit therefore moves the way a person does — by following the navigation's own link.
    const followed = await page.evaluate(`(() => {
      const link = [...document.querySelectorAll('a')].find((a) => a.getAttribute('href') === ${JSON.stringify(url)});
      if (!link) return false;
      link.click();
      return true;
    })()`);
    if (!followed)
      throw new Error(`No link to ${url} on ${await page.evaluate('location.pathname')}`);
    await page.waitFor(`location.pathname === ${JSON.stringify(url)}`);
  } else {
    await page.goto(`${base}${url}`);
  }
  // The app takes the page over after hydration; auditing the server's first paint would audit a
  // screen nobody sees. `main` holding something is how far "the screen is there" goes without
  // knowing which screen it is.
  await page.waitFor('document.querySelector("#main, main")?.textContent?.trim().length > 0');
  // Screens arrive with an entrance that fades them in. Measuring colour while that runs measures
  // a frame nobody is meant to read, and it is why an audit run twice can report two different
  // contrast ratios: wait until every animation on the page has finished first.
  await page.waitFor(
    'document.getAnimations().every((a) => a.playState === "finished" || a.playState === "idle")',
  );
  await page.evaluate(`(() => { if (!window.axe) { ${axe} } })()`);
  const result = await page.evaluate(
    `window.axe.run(document, ${JSON.stringify(axeOptions)}).then((r) => ({
       violations: r.violations.map((v) => ({
         id: v.id,
         impact: v.impact,
         help: v.help,
         nodes: v.nodes.slice(0, 6).map((n) => ({
           target: n.target.join(' '),
           // What exactly is wrong with this element — the measured contrast, the missing name.
           why: [...n.any, ...n.all, ...n.none].map((c) => c.message).join('; '),
         })),
       })),
       incomplete: r.incomplete.map((v) => ({ id: v.id, nodes: v.nodes.length })),
       passes: r.passes.length,
       heading: (document.querySelector('h1') || {}).textContent || null,
       at: location.pathname,
     }))`,
  );
  if (result.at !== url.split('?')[0]) {
    throw new Error(
      `asked for ${url} and got ${result.at}: the audit would have named the wrong screen`,
    );
  }
  results.push({ name, url, ...result });
}

for (const target of chosen) await audit(target);

if (totpSecret && !args.get('urls')) {
  // The browser starts on a clean profile, so the administrator's account has to sign in first.
  // The fictitious local provider is the only one that can be driven without a person, which is
  // the same reason the admin panels can only be audited against a development backend.
  await page.goto(`${base}/en/sign-in?reason=admin&level=account&use=account&next=%2Fadmin`);
  await page.waitFor(
    `[...document.querySelectorAll('button')].some((b) => b.textContent.includes('${localProviderLabel}') && !b.disabled)`,
  );
  await page.evaluate(
    `[...document.querySelectorAll('button')].find((b) => b.textContent.includes('${localProviderLabel}')).click()`,
  );
  await page.waitFor(`location.pathname.includes('/identity/login/local/')`);
  await page.click('input[name=code]');
  await page.type(account);
  await page.evaluate(
    `[...document.querySelectorAll('button')].find((b) => b.type === 'submit').click()`,
  );
  await page.waitFor(`location.pathname.startsWith('/admin')`, { tries: 300 });
  await clearDisplayNameGate();

  await page.goto(`${base}/admin/sign-in`);
  await page.waitFor(
    `document.querySelector('input:not([type=hidden]):not([readonly]):not([disabled])')`,
  );
  await page.click('input:not([type=hidden]):not([readonly]):not([disabled])');
  await page.type(await totp(totpSecret));
  const entered = await page.evaluate(
    `(() => {
       const button = [...document.querySelectorAll('button')].find((b) => !b.disabled && b.textContent.trim().length > 0);
       if (button) { button.click(); return true; }
       return false;
     })()`,
  );
  if (!entered) throw new Error('The admin sign-in form would not submit.');
  await page.waitFor(
    `location.pathname.startsWith('/admin') && location.pathname !== '/admin/sign-in'`,
    { tries: 300 },
  );
  for (const target of adminPages) await audit({ ...target, within: true });
}

// An account with no display name yet is asked for one before any page shows.
async function clearDisplayNameGate() {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const gate = await page.evaluate(
      `!!document.querySelector('input:not([type=hidden]):not([readonly]):not([disabled])') && !location.pathname.includes('sign-in')`,
    );
    if (!gate) return;
    await page.click('input:not([type=hidden]):not([readonly]):not([disabled])');
    await page.type(account);
    await page.evaluate(
      `(() => { const b = [...document.querySelectorAll('button')].find((b) => !b.disabled && b.textContent.trim().length > 0); if (b) b.click(); })()`,
    );
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

await chrome.close();

// --- the report ----------------------------------------------------------------------------------

let violations = 0;
console.log(`\nWCAG 2.2 AA audit (axe-core ${AXE_VERSION}) — ${base}\n`);
for (const result of results) {
  const mark =
    result.violations.length === 0 ? 'clean' : `${result.violations.length} VIOLATION(S)`;
  console.log(
    `${result.name}  [${result.url}]  "${(result.heading ?? '').trim().slice(0, 40)}"  ${result.passes} rules passed — ${mark}`,
  );
  for (const violation of result.violations) {
    violations += 1;
    console.log(`    ! ${violation.id} (${violation.impact}): ${violation.help}`);
    for (const node of violation.nodes) console.log(`        ${node.target} — ${node.why}`);
  }
  // "Incomplete" is axe saying it cannot decide on its own — it is a list for the person running
  // the audit to look at, not a failure.
  for (const item of result.incomplete) {
    console.log(`    ? ${item.id}: ${item.nodes} element(s) axe could not decide about`);
  }
}

console.log(
  violations === 0
    ? `\nOK: no WCAG 2.2 A/AA violation on ${results.length} screens.`
    : `\n${violations} violation(s) across ${results.length} screens.`,
);
process.exit(violations === 0 ? 0 : 1);
