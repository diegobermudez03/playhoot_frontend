import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';

import { DesignRoute } from '../dev/DesignRoute';
import { GameHostLabRoute } from '../dev/GameHostLabRoute';
import { enterCodePath, guestSignInRoute, signInRoute } from '../features/paths';
import { EnterCodeRoute } from '../features/session-join/EnterCodeRoute';
import { SessionRoute } from '../features/session-join/SessionRoute';
import { GuestSignInRoute } from '../features/sign-in/GuestSignInRoute';
import { SignInRoute } from '../features/sign-in/SignInRoute';
import { NotFoundRoute } from './NotFoundRoute';
import { RootLayout } from './RootLayout';
import { RouteError } from './RouteError';

// The URL is the source of truth for which feature is open (ARCHITECTURE.md, plan §5). Each route
// mounts its feature, which rebuilds its state from URL + backend; nothing survives a route exit.
// Session URLs are composed in `features/paths.ts` (ADR-0002).
const routes: RouteObject[] = [
  // There is no home page yet (it comes late): the root only sends people to the code entry.
  { path: '/', element: <Navigate to={enterCodePath} replace /> },
  { path: enterCodePath, element: <EnterCodeRoute /> },
  // Where a person is sent to authenticate, with `next` to continue (features/access.tsx).
  { path: signInRoute, element: <SignInRoute /> },
  { path: guestSignInRoute, element: <GuestSignInRoute /> },
  {
    // One pathless parent for both Session URLs, so moving from the code URL to the UUID URL
    // keeps the same mounted feature (and its connection).
    element: <SessionRoute />,
    children: [{ path: '/join/:joinCode' }, { path: '/sessions/:sessionUUID/play' }],
  },
];

if (import.meta.env.DEV) {
  routes.push(
    { path: '/design', element: <DesignRoute /> },
    { path: '/dev/game-host', element: <GameHostLabRoute /> },
  );
}

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteError />,
    children: [...routes, { path: '*', element: <NotFoundRoute /> }],
  },
]);
