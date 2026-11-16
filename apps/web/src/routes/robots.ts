import type { LoaderFunctionArgs } from 'react-router';

import { siteOrigin } from '../seo/siteOrigin';

// Public pages are the home and the join entry of each language; everything else is either a
// private link (a Session, a game, an account) or a page that only makes sense when a page sent
// you there (D-019).
const disallowed = [
  '/sign-in',
  '/join/',
  '/sessions/',
  '/games/',
  '/account/',
  '/connect-ai',
  '/admin',
];

export function loader({ request }: LoaderFunctionArgs) {
  const origin = siteOrigin(new URL(request.url));
  const body = [
    'User-agent: *',
    ...disallowed.map((path) => `Disallow: ${path}`),
    'Allow: /',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
