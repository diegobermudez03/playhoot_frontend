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
//   node scripts/verify/a11y.mjs --base ... --no-account   # skip the signed-in screens
//
// Without --urls it also signs a fresh account in at the local provider, in a browser of its
// own, and audits what H3 put behind sign-in: the email code steps, the acceptance gate, the
// profile area, the teacher screen, the notifications pages and the declaration. It ends with a
// keyboard pass over the code field and the deletion dialog, scripted, so it is re-run rather
// than re-done by hand.
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
  if (!argument.startsWith('--')) continue;
  const value = process.argv[index + 1];
  args.set(argument.slice(2), value === undefined || value.startsWith('--') ? true : value);
}
const base = (args.get('base') ?? 'http://localhost:5173').replace(/\/$/, '');
const totpSecret = args.get('totp-secret') ?? process.env.PLAYHOOT_ADMIN_TOTP_SECRET ?? null;
// The administrator's name at the fictitious local provider, used only with --totp-secret.
const account = args.get('account') ?? 'T207Operator';
const localProviderLabel = args.get('local-provider') ?? 'Local test account';

// The screens H2 delivered, then H3's. The public ones answer to anybody; the admin panels need admin mode,
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
  { url: '/admin/markets', name: 'admin markets' },
  { url: '/admin/texts', name: 'admin acceptance texts' },
];
// Behind sign-in (H3). An account sees each of them; reloading is fine, because the account's
// credential is stored, unlike admin mode.
const accountPages = [
  { url: '/profile', name: 'profile' },
  { url: '/profile/methods', name: 'profile: ways in' },
  { url: '/profile/legal', name: 'profile: legal texts' },
  { url: '/profile/delete', name: 'profile: delete' },
  { url: '/teacher', name: 'teacher' },
  { url: '/notifications', name: 'notifications' },
  { url: '/notifications/preferences', name: 'notification preferences' },
  { url: '/declaration?function=create-games&next=%2Fgames%2Fnew', name: 'declaration' },
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
const mainPage = await chrome.newPage();
await mainPage.resize(1280, 900);

const results = [];
const keyboard = [];
let page = mainPage;

async function audit({ url, name, within = false, here = false }) {
  if (here) {
    // The screen is a state of the page already open (a step of a form, a gate): audit it as is.
  } else if (within) {
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
       incomplete: r.incomplete.map((v) => ({ id: v.id, nodes: v.nodes.length, first: v.nodes[0]?.target.join(' ') ?? '' })),
       passes: r.passes.length,
       heading: (document.querySelector('h1') || {}).textContent || null,
       at: location.pathname,
     }))`,
  );
  if (!here && result.at !== url.split('?')[0]) {
    throw new Error(
      `asked for ${url} and got ${result.at}: the audit would have named the wrong screen`,
    );
  }
  results.push({ name, url, ...result });
}

for (const target of chosen) await audit(target);

if (!args.get('urls') && !args.get('no-account')) await auditAccount();

if (totpSecret && !args.get('urls')) {
  // The browser starts on a clean profile, so the administrator's account has to sign in first.
  // The fictitious local provider is the only one that can be driven without a person, which is
  // the same reason the admin panels can only be audited against a development backend.
  await page.goto(`${base}/en/sign-in?reason=admin&level=account&use=account&next=%2Fadmin`);
  await signInLocally(account);
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

// Signs in at the local provider as name, from the sign-in screen the page is on.
async function signInLocally(name) {
  await page.waitFor(
    `[...document.querySelectorAll('button')].some((b) => b.textContent.includes('${localProviderLabel}') && !b.disabled)`,
  );
  await page.evaluate(
    `[...document.querySelectorAll('button')].find((b) => b.textContent.includes('${localProviderLabel}')).click()`,
  );
  await page.waitFor(`location.pathname.includes('/identity/login/local/')`);
  await page.click('input[name=code]');
  await page.type(name);
  await page.evaluate(
    `[...document.querySelectorAll('button')].find((b) => b.type === 'submit').click()`,
  );
}

function check(name, passed, detail = '') {
  keyboard.push({ name, passed: Boolean(passed), detail: detail ?? '' });
}

function settle(ms = 600) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function focusedText() {
  return page.evaluate(`document.activeElement?.textContent?.trim() ?? ''`);
}
function tab() {
  return page.key('Tab', { windowsVirtualKeyCode: 9 });
}

// H3's screens, as a fresh account sees them, in a browser of its own so the admin part below
// starts signed out.
async function auditAccount() {
  const member = `T307Member${Date.now().toString(36)}`;
  const memberChrome = await launchChrome({ port: 9334, headless: true, windowSize: '1280,900' });
  page = await memberChrome.newPage();
  await page.resize(1280, 900);
  try {
    // Chrome here starts in Spanish; the app's own picker stores the reading language.
    await page.goto(`${base}/en`);
    await page.evaluate(`localStorage.setItem('playhoot.locale.v1', 'en')`);

    // The email code way in: the address step, the code step, and a wrong code on the field.
    const signIn = '/en/sign-in?reason=create-game&level=account&next=%2Fprofile';
    await audit({ url: signIn, name: 'sign-in: email address step' });
    await page.click('input[type=email]');
    await page.type(`${member.toLowerCase()}@example.com`);
    await page.evaluate(`document.querySelector('input[type=email]').form.requestSubmit()`);
    await page.waitFor(`!!document.querySelector('input[autocomplete=one-time-code]')`);
    await audit({ url: signIn, name: 'sign-in: code step', here: true });
    await page.click('input[autocomplete=one-time-code]');
    await page.type('000000');
    await page.evaluate(
      `document.querySelector('input[autocomplete=one-time-code]').form.requestSubmit()`,
    );
    await page.waitFor(
      `document.querySelector('input[autocomplete=one-time-code]')?.getAttribute('aria-invalid') === 'true'`,
    );
    await audit({ url: signIn, name: 'sign-in: a wrong code', here: true });
    const codeField = await page.evaluate(`(() => {
      const input = document.querySelector('input[autocomplete=one-time-code]');
      const said = (input.getAttribute('aria-describedby') || '').split(' ')
        .map((id) => document.getElementById(id)?.textContent?.trim()).filter(Boolean);
      return { focused: document.activeElement === input, said };
    })()`);
    check(
      'code field: a wrong code is announced on the field, and focus stays on it',
      codeField.focused && codeField.said.length > 0,
      codeField.said.join(' / '),
    );
    await tab();
    const afterCode = await page.evaluate(`document.activeElement?.tagName ?? ''`);
    check('code field: Tab moves on to a button', afterCode === 'BUTTON', await focusedText());

    // The way in the audit can drive without a mailbox: the local provider.
    await page.goto(
      `${base}/en/sign-in?reason=create-game&level=account&use=account&next=%2Fprofile`,
    );
    await signInLocally(member);
    await page.waitFor(`location.pathname === '/profile'`, { tries: 300 });
    await clearDisplayNameGate(member);
    await page.waitFor(`!!document.querySelector('input[type=checkbox]')`, { tries: 300 });
    await audit({ url: '/profile', name: 'acceptance gate', here: true });
    await page.click('input[type=checkbox]');
    await page.evaluate(
      `[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Accept and continue')).click()`,
    );
    await page.waitFor(`!document.body.textContent.includes('Accept and continue')`, {
      tries: 300,
    });

    for (const target of accountPages) await audit(target);

    // The deletion dialog by keyboard only: tick, open, land on Cancel, stay inside, leave.
    await page.goto(`${base}/profile/delete`);
    await page.waitFor(`!!document.querySelector('input[type=checkbox]')`);
    await page.evaluate(`document.querySelector('input[type=checkbox]').focus()`);
    await page.key(' ', { code: 'Space', windowsVirtualKeyCode: 32, text: ' ' });
    await settle(200);
    await tab();
    const onDelete = await focusedText();
    check(
      'deletion: Space ticks the box and Tab reaches the delete button',
      onDelete === 'Delete my identity',
      onDelete,
    );
    await page.key('Enter', { windowsVirtualKeyCode: 13, text: '\r' });
    await page.waitFor(`!!document.querySelector('dialog[open]')`);
    const opened = await page.evaluate(`(() => {
      const dialog = document.querySelector('dialog[open]');
      return {
        inside: dialog.contains(document.activeElement),
        on: document.activeElement?.textContent?.trim(),
        named: !!document.getElementById(dialog.getAttribute('aria-labelledby') || '')?.textContent,
      };
    })()`);
    check(
      'deletion dialog: Enter opens it on Cancel, and it is named',
      opened.inside && opened.on === 'Cancel' && opened.named,
      opened.on,
    );
    // A native modal dialog makes the page behind it inert: Tab cycles through the dialog and
    // may pass through the browser's own controls, but never reaches the page behind.
    let stayed = true;
    for (let press = 0; press < 6; press += 1) {
      await tab();
      stayed =
        stayed &&
        (await page.evaluate(`(() => {
          const active = document.activeElement;
          return !active || active === document.body || !!document.querySelector('dialog[open]')?.contains(active);
        })()`));
    }
    check('deletion dialog: Tab never reaches the page behind it', stayed);
    await page.key('Escape', { windowsVirtualKeyCode: 27 });
    await page.waitFor(`!document.querySelector('dialog[open]')`);
    const returned = await focusedText();
    check(
      'deletion dialog: Escape closes it and focus returns to the delete button',
      returned === 'Delete my identity',
      returned,
    );
    check(
      'deletion dialog: closing it deleted nothing',
      (await page.evaluate('location.pathname')) === '/profile/delete',
    );
  } finally {
    page = mainPage;
    await memberChrome.close();
  }
}

// An account with no display name yet is asked for one before any page shows.
async function clearDisplayNameGate(name = account) {
  const field = `document.querySelector('main input:not([type=hidden]):not([type=checkbox]):not([readonly]):not([disabled])')`;
  // The gate arrives once the app knows who signed in: give it a moment before deciding.
  await page.waitFor(`!!${field} || !!document.querySelector('main h1')`, { tries: 300 });
  await settle(1000);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!(await page.evaluate(`!!${field} && !location.pathname.includes('sign-in')`))) return;
    await page.evaluate(`${field}.focus()`);
    await page.type(name);
    // Submit the gate's own form: the first button on the page belongs to the shell.
    await page.evaluate(`(() => {
      const form = ${field}.form;
      if (form) form.requestSubmit();
    })()`);
    await settle(2000);
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
    console.log(
      `    ? ${item.id}: ${item.nodes} element(s) axe could not decide about (first: ${item.first})`,
    );
  }
}

let keyboardFailures = 0;
if (keyboard.length > 0) console.log('\nKeyboard pass');
for (const item of keyboard) {
  if (!item.passed) keyboardFailures += 1;
  const detail = item.detail ? `  (${item.detail})` : '';
  console.log(`  ${item.passed ? 'ok  ' : 'FAIL'} ${item.name}${detail}`);
}

const clean = violations === 0 && keyboardFailures === 0;
console.log(
  clean
    ? `\nOK: no WCAG 2.2 A/AA violation on ${results.length} screens; ${keyboard.length} keyboard checks pass.`
    : `\n${violations} violation(s) across ${results.length} screens; ${keyboardFailures} keyboard check(s) failed.`,
);
process.exit(clean ? 0 : 1);
