// What a search engine sees, checked against a running host with no JavaScript at all (D-019).
//
// Every public page exists once per language. This script fetches each one as a crawler would —
// a plain GET, nothing executed — and checks that the answer already carries the page's content,
// its title and description in that language, the address that names it, the alternates of the
// other two languages, Open Graph, and the structured data the route declares. It also checks
// robots.txt, the sitemap, the redirects of the bare paths and that an address no route answers
// is a 404 rather than a page.
//
//   node scripts/verify/seo.mjs [--base http://localhost:3000] [--origin https://playhoot.com]
//
// `--base` is where to ask; `--origin` is the public origin the build was given
// (`PLAYHOOT_SITE_URL`), which is what every canonical and alternate must name. When `--origin`
// is left out it defaults to `--base`, which is what a dev server answers with.

import process from 'node:process';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const argument = process.argv[index];
  if (argument.startsWith('--')) args.set(argument.slice(2), process.argv[index + 1]);
}

const base = (args.get('base') ?? 'http://localhost:3000').replace(/\/$/, '');
const origin = (args.get('origin') ?? base).replace(/\/$/, '');

// Mirrors `src/i18n/localePaths.ts`. Written out here on purpose: this script checks the served
// HTML against the contract, so it must not read the same source the pages were built from.
const locales = [
  { locale: 'es', segment: 'es', openGraph: 'es_ES' },
  { locale: 'en', segment: 'en', openGraph: 'en_US' },
  { locale: 'pt-BR', segment: 'pt', openGraph: 'pt_BR' },
];
const publicPaths = ['/', '/join', '/sign-in'];
const indexablePaths = ['/', '/join'];

const failures = [];
const notes = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function localePath(segment, path) {
  return path === '/' ? `/${segment}` : `/${segment}${path}`;
}

// --- reading the HTML -------------------------------------------------------------------------
// Deliberately string work rather than a DOM: nothing here may depend on a parser being forgiving
// in the same way a browser is.

function tagContent(html, tag) {
  const match = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return match ? match[1].trim() : null;
}

function metaContent(html, attribute, value) {
  const pattern = new RegExp(`<meta[^>]*\\b${attribute}="${value}"[^>]*>`, 'i');
  const tag = html.match(pattern)?.[0];
  return tag?.match(/\bcontent="([^"]*)"/i)?.[1] ?? null;
}

function linkHref(html, rel, hrefLang) {
  const tags = html.match(/<link\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    if (!new RegExp(`\\brel="${rel}"`, 'i').test(tag)) continue;
    if (hrefLang && !new RegExp(`\\bhrefLang="${hrefLang}"`, 'i').test(tag)) continue;
    if (!hrefLang && /\bhrefLang="/i.test(tag)) continue;
    return tag.match(/\bhref="([^"]*)"/i)?.[1] ?? null;
  }
  return null;
}

function jsonLd(html) {
  const match = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return 'unparseable';
  }
}

// The text a person would read, with every tag and the hydration payload removed. A page whose
// content only appears once JavaScript runs fails this.
function visibleText(html) {
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? '';
  return body
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function get(path, options = {}) {
  const response = await fetch(`${base}${path}`, { redirect: 'manual', ...options });
  return { response, body: await response.text() };
}

// --- the public pages -------------------------------------------------------------------------

const titles = new Map();
const descriptions = new Map();

for (const path of publicPaths) {
  for (const { locale, segment, openGraph } of locales) {
    const address = localePath(segment, path);
    const where = `${address} (${locale})`;
    const { response, body } = await get(address, {
      headers: { 'User-Agent': 'Playhoot-SEO-Check/1.0 (crawler simulation)' },
    });

    check(response.status === 200, `${where}: answered ${response.status}, expected 200`);
    if (response.status !== 200) continue;

    const lang = body.match(/<html[^>]*\blang="([^"]*)"/i)?.[1] ?? null;
    check(lang === locale, `${where}: <html lang> is ${lang ?? 'missing'}, expected ${locale}`);

    const title = tagContent(body, 'title');
    check(Boolean(title), `${where}: no <title>`);
    const description = metaContent(body, 'name', 'description');
    check(Boolean(description), `${where}: no meta description`);
    if (title) titles.set(where, title);
    if (description) descriptions.set(where, description);

    const canonical = linkHref(body, 'canonical');
    const expectedCanonical = `${origin}${address}`;
    check(
      canonical === expectedCanonical,
      `${where}: canonical is ${canonical ?? 'missing'}, expected ${expectedCanonical}`,
    );

    for (const other of locales) {
      const alternate = linkHref(body, 'alternate', other.locale);
      const expected = `${origin}${localePath(other.segment, path)}`;
      check(
        alternate === expected,
        `${where}: hreflang ${other.locale} is ${alternate ?? 'missing'}, expected ${expected}`,
      );
    }
    const xDefault = linkHref(body, 'alternate', 'x-default');
    const expectedDefault = `${origin}${localePath('en', path)}`;
    check(
      xDefault === expectedDefault,
      `${where}: hreflang x-default is ${xDefault ?? 'missing'}, expected ${expectedDefault}`,
    );

    check(
      metaContent(body, 'property', 'og:title') === title,
      `${where}: og:title does not match the title`,
    );
    check(
      metaContent(body, 'property', 'og:description') === description,
      `${where}: og:description does not match the description`,
    );
    check(
      metaContent(body, 'property', 'og:url') === expectedCanonical,
      `${where}: og:url does not match the canonical`,
    );
    check(
      metaContent(body, 'property', 'og:locale') === openGraph,
      `${where}: og:locale is not ${openGraph}`,
    );
    check(Boolean(metaContent(body, 'property', 'og:image')), `${where}: no og:image`);

    // A page offered to crawlers must not say noindex; a page that is not offered must.
    const robots = metaContent(body, 'name', 'robots');
    if (indexablePaths.includes(path)) {
      check(!robots?.includes('noindex'), `${where}: indexable page carries robots "${robots}"`);
    } else {
      check(
        robots?.includes('noindex') === true,
        `${where}: page is outside the sitemap but does not say noindex (robots "${robots}")`,
      );
    }

    // Content, without a line of JavaScript having run. Only a page offered to crawlers has to
    // carry it: the authentication screen is `noindex` and needs the browser to know who is
    // already signed in and which providers the backend offers, so it is taken over at hydration
    // (T-207). Every public page, indexable or not, must still be a complete document with its
    // frame and its metadata.
    check(/<main\b[^>]*\bid="main"/i.test(body), `${where}: no <main id="main">`);
    if (indexablePaths.includes(path)) {
      const heading = tagContent(body, 'h1');
      check(
        Boolean(heading && heading.replace(/<[^>]+>/g, '').trim()),
        `${where}: no <h1> with text`,
      );
      const text = visibleText(body);
      check(text.length > 200, `${where}: only ${text.length} characters of text in the answer`);
    }

    // The structured data a route declares (the home page declares WebSite).
    const structured = jsonLd(body);
    if (path === '/') {
      check(structured !== null, `${where}: no JSON-LD`);
      check(structured !== 'unparseable', `${where}: JSON-LD does not parse`);
      if (structured && structured !== 'unparseable') {
        check(structured['@type'] === 'WebSite', `${where}: JSON-LD @type is not WebSite`);
        check(
          structured.inLanguage === locale,
          `${where}: JSON-LD inLanguage is ${structured.inLanguage}, expected ${locale}`,
        );
        check(
          structured.url === expectedCanonical,
          `${where}: JSON-LD url is ${structured.url}, expected ${expectedCanonical}`,
        );
      }
    }
  }
}

// The same page in two languages must not be the same words: that is what tells a search engine
// the alternates are real.
for (const path of publicPaths) {
  const seen = new Map();
  for (const { locale, segment } of locales) {
    const title = titles.get(`${localePath(segment, path)} (${locale})`);
    if (!title) continue;
    const already = seen.get(title);
    check(!already, `${path}: ${locale} and ${already} share the title "${title}"`);
    seen.set(title, locale);
  }
}

// --- robots.txt and the sitemap ---------------------------------------------------------------

{
  const { response, body } = await get('/robots.txt');
  check(response.status === 200, `/robots.txt: answered ${response.status}`);
  check(
    (response.headers.get('content-type') ?? '').includes('text/plain'),
    `/robots.txt: content type is ${response.headers.get('content-type')}`,
  );
  check(body.includes('User-agent: *'), '/robots.txt: no "User-agent: *"');
  check(
    body.includes(`Sitemap: ${origin}/sitemap.xml`),
    `/robots.txt: does not name ${origin}/sitemap.xml`,
  );
  for (const path of [
    '/sign-in',
    '/sessions/',
    '/games/',
    '/account/',
    '/admin',
    '/profile',
    '/notifications',
    '/teacher',
    '/declaration',
  ]) {
    check(body.includes(`Disallow: ${path}`), `/robots.txt: ${path} is not disallowed`);
  }
}

{
  const { response, body } = await get('/sitemap.xml');
  check(response.status === 200, `/sitemap.xml: answered ${response.status}`);
  check(
    (response.headers.get('content-type') ?? '').includes('xml'),
    `/sitemap.xml: content type is ${response.headers.get('content-type')}`,
  );
  check(body.startsWith('<?xml'), '/sitemap.xml: does not begin with an XML declaration');
  check(body.includes('<urlset'), '/sitemap.xml: no <urlset>');

  const locs = [...body.matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) => match[1]);
  const expected = indexablePaths.flatMap((path) =>
    locales.map(({ segment }) => `${origin}${localePath(segment, path)}`),
  );
  for (const url of expected) check(locs.includes(url), `/sitemap.xml: ${url} is missing`);
  check(
    locs.length === expected.length,
    `/sitemap.xml: ${locs.length} entries, expected ${expected.length}`,
  );
  check(!locs.some((url) => url.includes('/sign-in')), '/sitemap.xml: a sign-in address is listed');
  for (const { locale } of locales) {
    check(
      body.includes(`hreflang="${locale}"`),
      `/sitemap.xml: no alternate declared for ${locale}`,
    );
  }
  check(body.includes('hreflang="x-default"'), '/sitemap.xml: no x-default alternate');
}

// --- the bare paths and an address nothing answers ----------------------------------------------

for (const path of publicPaths) {
  const { response } = await get(path, { headers: { 'Accept-Language': 'es-CO,es;q=0.9' } });
  check(
    response.status === 302 || response.status === 301,
    `${path}: answered ${response.status}, expected a redirect to a language`,
  );
  const location = response.headers.get('location');
  check(
    location === localePath('es', path),
    `${path}: redirects to ${location}, expected ${localePath('es', path)} for an es-CO reader`,
  );
}

{
  const { response } = await get('/this-address-answers-nothing');
  check(response.status === 404, `an unknown address answered ${response.status}, expected 404`);
}

// A page the server renders must not need the app to say which language it is in.
{
  const { response, body } = await get('/en', { headers: { 'Accept-Language': 'pt-BR,pt;q=0.9' } });
  check(response.status === 200, '/en with a Portuguese reader: not 200');
  check(
    /<html[^>]*\blang="en"/i.test(body),
    '/en answered in a language other than the one its address names',
  );
}

notes.push(`base ${base}, public origin ${origin}`);
notes.push(`${publicPaths.length} public paths x ${locales.length} languages`);

console.log(`SEO check — ${notes.join(' · ')}`);
if (failures.length === 0) {
  console.log('OK: every public page carries its content and metadata with no JavaScript.');
  process.exit(0);
}
console.error(`\n${failures.length} problem(s):`);
for (const failure of failures) console.error(`  - ${failure}`);
process.exit(1);
