import { Outlet } from 'react-router';

import { DisplayNameScreen } from '../features/sign-in/DisplayNameScreen';
import { identityKey } from './identityKey';
import { useAuth } from './ServicesContext';

// Shell around every route. Platform chrome (header, navigation) goes here when it exists. An
// account without a display name chooses one before any page shows, however it got there. When
// the person changes (another tab signed in as someone else), every page is rebuilt for the new
// one, so nothing of the previous person (a live connection, a lobby) stays open.
export function RootLayout() {
  const auth = useAuth();
  if (auth.status === 'authenticated' && !auth.displayName) return <DisplayNameScreen />;
  return <Outlet key={identityKey(auth)} />;
}
