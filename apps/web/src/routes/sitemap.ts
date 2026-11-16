import { supportedLocales, type Locale } from '@playhoot/app-core';
import type { LoaderFunctionArgs } from 'react-router';

import { indexablePublicPaths, localePath } from '../i18n/localePaths';
import { siteOrigin } from '../seo/siteOrigin';

// Every public page in every language, each entry naming its alternates, so a search engine
// offers a person the page in their own language (D-019, D-022).
export function loader({ request }: LoaderFunctionArgs) {
  const origin = siteOrigin(new URL(request.url));
  const url = (locale: Locale, path: string) => `${origin}${localePath(locale, path)}`;
  const entries = indexablePublicPaths.flatMap((path) =>
    supportedLocales.map((locale) => {
      const alternates = supportedLocales
        .map(
          (other) =>
            `    <xhtml:link rel="alternate" hreflang="${other}" href="${url(other, path)}" />`,
        )
        .join('\n');
      return [
        '  <url>',
        `    <loc>${url(locale, path)}</loc>`,
        alternates,
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${url('en', path)}" />`,
        '  </url>',
      ].join('\n');
    }),
  );
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries,
    '</urlset>',
    '',
  ].join('\n');
  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
