import { createBrowserRouter } from 'react-router';

import { JoinSessionRoute } from '../features/session-join/JoinSessionRoute';
import { HomeRoute } from './HomeRoute';
import { NotFoundRoute } from './NotFoundRoute';

// The URL is the source of truth for which feature is open (ARCHITECTURE.md, plan §5).
// The Session Play route is added when its URL contract is decided (session-play-v1 CHECKLIST).
export const router = createBrowserRouter([
  { path: '/', element: <HomeRoute /> },
  { path: '/join/:joinCode', element: <JoinSessionRoute /> },
  { path: '*', element: <NotFoundRoute /> },
]);
