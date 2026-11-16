// The PWA part of the build (D-020): the service worker and the offline page.
//
// Both are produced here rather than written by hand in `public/`, because both have to know the
// exact files this build produced: the worker precaches the shell, and the offline page is one of
// the files it precaches. The texts of the offline page come from the message catalogs, like
// every other text a person reads — it cannot use react-intl because it has to render with no
// application running and no network.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build as esbuild } from 'esbuild';
import type { Plugin } from 'vite';

import { catalogs } from './src/i18n/catalogs';
import { localeCookieName } from './src/i18n/localeCookie';

// Files from `public/` that belong to the installed shell. A missing one is left out rather than
// failing the worker's installation: an icon the creator has not supplied yet must not cost the
// person the offline page.
const publicShellFiles = [
  '/site.webmanifest',
  '/favicon.svg',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/icon-maskable-512.png',
  '/assets/icons/apple-touch-icon.png',
];

const offlinePage = '/offline.html';
const serviceWorkerFile = 'sw.js';

interface BundledChunk {
  type: string;
  facadeModuleId?: string | null;
  imports?: string[];
  viteMetadata?: { importedCss?: Set<string> };
}

// The browser bundle declares every route module as an entry of its own, so "the shell" has to be
// named: the client entry and the document it renders, with everything they import before a route
// is even chosen. A route's own files are fetched when it is first opened and kept from then on,
// because their names carry their content (see `strategyFor`).
const shellModules = ['src/entry.client.tsx', 'src/root.tsx'];

export function playhootPwa(): Plugin {
  return {
    name: 'playhoot-pwa',
    apply: 'build',
    async generateBundle(_options, bundle) {
      // React Router builds the browser bundle and then the server one; only the browser build
      // has a shell to cache.
      if (this.environment?.name !== 'client') return;

      const offline = offlineDocument();
      const precache = [offlinePage, ...existingPublicFiles(), ...shellFiles(bundle)];
      const source = readFileSync(resolveFromHere('src/pwa/sw.ts'), 'utf8');
      // The identity of this build: the same inputs give the same worker, so rebuilding without
      // changing anything does not tell everyone that a new version is waiting.
      const buildId = createHash('sha256')
        .update(source)
        .update(offline)
        .update(precache.join('\n'))
        .digest('hex')
        .slice(0, 12);

      this.emitFile({ type: 'asset', fileName: offlinePage.slice(1), source: offline });
      this.emitFile({
        type: 'asset',
        fileName: serviceWorkerFile,
        source: await buildServiceWorker(buildId, precache),
      });
    },
  };
}

// The worker is a module worker built on its own: it runs outside any document and shares nothing
// with the application bundle but its routing policy.
async function buildServiceWorker(buildId: string, precache: string[]): Promise<string> {
  const result = await esbuild({
    entryPoints: [resolveFromHere('src/pwa/sw.ts')],
    bundle: true,
    format: 'esm',
    target: 'es2022',
    write: false,
    define: {
      __PLAYHOOT_BUILD__: JSON.stringify(buildId),
      __PLAYHOOT_PRECACHE__: JSON.stringify(precache),
      __PLAYHOOT_OFFLINE_PAGE__: JSON.stringify(offlinePage),
    },
  });
  const output = result.outputFiles?.[0];
  if (!output) throw new Error('the service worker produced no output');
  return output.text;
}

function resolveFromHere(relative: string): string {
  return fileURLToPath(new URL(relative, import.meta.url));
}

function existingPublicFiles(): string[] {
  return publicShellFiles.filter((file) => existsSync(resolveFromHere(`public${file}`)));
}

function shellFiles(bundle: Record<string, unknown>): string[] {
  const files = new Set<string>();
  const visit = (fileName: string) => {
    if (files.has(fileName)) return;
    const chunk = bundle[fileName] as BundledChunk | undefined;
    if (!chunk || chunk.type !== 'chunk') return;
    files.add(fileName);
    for (const css of chunk.viteMetadata?.importedCss ?? []) files.add(css);
    for (const imported of chunk.imports ?? []) visit(imported);
  };
  for (const [fileName, value] of Object.entries(bundle)) {
    const chunk = value as BundledChunk;
    // React Router marks a route module's chunk with a query of its own, and Windows gives the
    // path backslashes.
    const module = chunk.facadeModuleId?.split(sep).join('/').split('?')[0];
    if (chunk.type !== 'chunk' || !module) continue;
    if (shellModules.some((shell) => module.endsWith(shell))) visit(fileName);
  }
  return [...files].sort().map((file) => `/${file}`);
}

// The offline page. It is shown with no application running, so it carries its own words in the
// three languages and picks one the way the server would: the remembered choice first, then what
// the browser asks for. None of our scripts has loaded, so the retry button is a plain reload.
function offlineDocument(): string {
  const languages = Object.keys(catalogs).map((locale) => {
    const messages = catalogs[locale as keyof typeof catalogs];
    return {
      locale,
      title: messages['offline.title'],
      body: messages['offline.body'],
      retry: messages['offline.retry'],
    };
  });
  const fallback = languages.find((language) => language.locale === 'en') ?? languages[0];
  if (!fallback) throw new Error('no language to write the offline page in');

  const sections = languages
    .map(
      (language) => `      <section data-locale="${language.locale}" hidden>
        <h1>${escapeHtml(language.title)}</h1>
        <p>${escapeHtml(language.body)}</p>
        <button type="button" onclick="location.reload()">${escapeHtml(language.retry)}</button>
      </section>`,
    )
    .join('\n');

  // The colours are the semantic tokens of `src/ui/tokens.css`; this page cannot load a
  // stylesheet, so it carries the few values it needs.
  return `<!doctype html>
<html lang="${fallback.locale}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="robots" content="noindex" />
    <meta name="referrer" content="no-referrer" />
    <meta name="theme-color" content="#141134" />
    <title>${escapeHtml(fallback.title)}</title>
    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0;
        min-height: 100svh;
        display: grid;
        place-items: center;
        padding: 24px;
        background: #141134;
        color: #f8f6ff;
        font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
        text-align: center;
      }
      main { max-width: 32rem; display: grid; gap: 16px; justify-items: center; }
      h1 { font-size: 1.75rem; margin: 0; text-wrap: balance; }
      p { margin: 0; color: #c9c2f2; text-wrap: balance; line-height: 1.5; }
      button {
        font: inherit;
        font-weight: 700;
        cursor: pointer;
        border: 0;
        border-radius: 999px;
        padding: 12px 28px;
        background: #ffc53d;
        color: #2b1d00;
      }
      button:focus-visible { outline: 3px solid #ffd76a; outline-offset: 3px; }
    </style>
  </head>
  <body>
    <main>
${sections}
    </main>
    <script>
      (function () {
        var sections = document.querySelectorAll('[data-locale]');
        var cookie = /(?:^|; )${localeCookieName}=([^;]+)/.exec('; ' + document.cookie);
        var wanted = (cookie ? decodeURIComponent(cookie[1]) : navigator.language || '')
          .toLowerCase();
        var chosen = null;
        sections.forEach(function (section) {
          var locale = section.getAttribute('data-locale').split('-')[0].toLowerCase();
          if (!chosen && wanted.indexOf(locale) === 0) chosen = section;
        });
        if (!chosen) chosen = document.querySelector('[data-locale="${fallback.locale}"]');
        chosen.hidden = false;
        document.documentElement.lang = chosen.getAttribute('data-locale');
        document.title = chosen.querySelector('h1').textContent;
        chosen.querySelector('button').focus();
      })();
    </script>
  </body>
</html>
`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
