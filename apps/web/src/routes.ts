import { index, layout, prefix, route, type RouteConfig } from '@react-router/dev/routes';

import { localeSegments } from './i18n/localePaths';

// The URL is the source of truth for which feature is open (ARCHITECTURE.md, plan §5). Public
// pages exist once per language and are server-rendered; everything else keeps no language in its
// address and is taken over by the client app under `ClientLayout` (D-019, D-022).
const segments = Object.values(localeSegments);

// Public pages, one branch per language. React Router v7 has no pattern constraint on a dynamic
// segment, so each language is declared: `/es/...` can then never swallow `/games`.
const publicPages = segments.flatMap((segment) =>
  prefix(segment, [
    index('routes/home.tsx', { id: `home.${segment}` }),
    layout('app/ClientLayout.tsx', { id: `public.${segment}` }, [
      route('join', 'routes/join-entry.tsx', { id: `join-entry.${segment}` }),
      route('sign-in', 'routes/sign-in.tsx', { id: `sign-in.${segment}` }),
    ]),
  ]),
);

// The same pages without a language: each one sends the person to their own.
const publicRedirects = [
  index('routes/public-redirect.ts', { id: 'redirect.home' }),
  route('join', 'routes/public-redirect.ts', { id: 'redirect.join' }),
  route('sign-in', 'routes/public-redirect.ts', { id: 'redirect.sign-in' }),
];

const devTools =
  process.env.NODE_ENV === 'production'
    ? []
    : [
        route('design', 'routes/dev-design.tsx'),
        route('dev/game-host', 'routes/dev-game-host.tsx'),
      ];

export default [
  route('robots.txt', 'routes/robots.ts'),
  route('sitemap.xml', 'routes/sitemap.ts'),
  ...publicRedirects,
  ...publicPages,
  layout('app/ClientLayout.tsx', { id: 'app' }, [
    // Where a provider sends the person back after an account sign-in.
    route('sign-in/complete', 'routes/sign-in-complete.tsx'),
    // The creator's side: create a Session (an account's), then its host screen.
    route('sessions/new', 'routes/new-session.tsx'),
    route('sessions/:sessionUUID/host', 'routes/host.tsx'),
    // A creator's games: create one (an account's), then change its draft in its workspace.
    route('games', 'routes/my-games.tsx'),
    route('games/new', 'routes/new-game.tsx'),
    route('games/:gameUUID/edit', 'routes/game-workspace.tsx'),
    // AI apps (MCP): the consent they send the person to, and the account's connected ones.
    route('connect-ai', 'routes/connect-ai.tsx'),
    route('account/ai-connections', 'routes/ai-connections.tsx'),
    // One pathless parent for both Session URLs, so moving from the code URL to the UUID URL
    // keeps the same mounted feature (and its connection).
    layout('routes/session.tsx', [
      route('join/:joinCode', 'routes/session-url.tsx', { id: 'session.by-code' }),
      route('sessions/:sessionUUID/play', 'routes/session-url.tsx', { id: 'session.by-uuid' }),
    ]),
    ...devTools,
    route('*', 'routes/not-found.tsx'),
  ]),
] satisfies RouteConfig;
