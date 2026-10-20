import { createBrowserRouter, type RouteObject } from 'react-router';

import { DesignRoute } from '../dev/DesignRoute';
import { SessionRoute } from '../features/session-join/SessionRoute';
import { HomeRoute } from './HomeRoute';
import { NotFoundRoute } from './NotFoundRoute';
import { RootLayout } from './RootLayout';
import { RouteError } from './RouteError';

// The URL is the source of truth for which feature is open (ARCHITECTURE.md, plan §5). Each route
// mounts its feature, which rebuilds its state from URL + backend; nothing survives a route exit.
// Session URLs are composed in `features/paths.ts` (ADR-0002).
const routes: RouteObject[] = [
  { path: '/', element: <HomeRoute /> },
  {
    // One pathless parent for both Session URLs, so moving from the code URL to the UUID URL
    // keeps the same mounted feature (and its connection).
    element: <SessionRoute />,
    children: [{ path: '/join/:joinCode' }, { path: '/sessions/:sessionUUID/play' }],
  },
];

if (import.meta.env.DEV) routes.push({ path: '/design', element: <DesignRoute /> });

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteError />,
    children: [...routes, { path: '*', element: <NotFoundRoute /> }],
  },
]);
