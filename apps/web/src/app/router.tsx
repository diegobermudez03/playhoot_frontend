import { createBrowserRouter } from 'react-router';

import { JoinSessionRoute } from '../features/session-join/JoinSessionRoute';
import { HomeRoute } from './HomeRoute';
import { NotFoundRoute } from './NotFoundRoute';
import { RootLayout } from './RootLayout';
import { RouteError } from './RouteError';

// The URL is the source of truth for which feature is open (ARCHITECTURE.md, plan §5). Each route
// mounts its feature, which rebuilds its state from URL + backend; nothing survives a route exit.
// The Session Play route is added when its URL contract is decided (session-play-v1 CHECKLIST).
export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <HomeRoute /> },
      { path: '/join/:joinCode', element: <JoinSessionRoute /> },
      { path: '*', element: <NotFoundRoute /> },
    ],
  },
]);
