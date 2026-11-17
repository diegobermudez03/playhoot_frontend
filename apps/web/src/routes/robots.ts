import type { LoaderFunctionArgs } from 'react-router';

import { siteOrigin } from '../seo/siteOrigin';

// Public pages are the home and the join entry of each language; everything else is either a
// private link (a Session, a game, an account, a person's own pages) or a page that only makes
// sense when a page sent you there (D-019).
const disallowed = [
  '/sign-in',
  '/join/',
  '/sessions/',
  '/games/',
  '/account/',
  '/connect-ai',
  '/admin',
  // A person's own pages (H3): their profile, their notifications, the teacher face of their
  // account, and the declaration a gated flow sends them to.
  '/profile',
  '/notifications',
  '/teacher',
  '/declaration',
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
