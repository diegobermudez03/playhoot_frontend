import type { Config } from '@react-router/dev/config';

import { localeSegments } from './src/i18n/localePaths';

// Framework mode (D-019): public routes are server-rendered with their metadata, and those whose
// content is fixed at build time are written out as HTML. Everything else is rendered on the
// server as an empty shell and taken over by the client app after hydration (see ClientLayout).
export default {
  // This repository keeps the app under `src/`, not the default `app/`.
  appDirectory: 'src',
  ssr: true,
  // Home is the same for everyone who is not signed in, so each locale is a static file; robots
  // and the sitemap are static too. Every other route is rendered per request.
  prerender: [
    ...Object.values(localeSegments).map((segment) => `/${segment}`),
    '/robots.txt',
    '/sitemap.xml',
  ],
} satisfies Config;
