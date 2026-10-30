import { Outlet } from 'react-router';

import { DisplayNameScreen } from '../features/sign-in/DisplayNameScreen';
import { useAuth } from './ServicesContext';

// Shell around every route. Platform chrome (header, navigation) goes here when it exists. An
// account without a display name chooses one before any page shows, however it got there.
export function RootLayout() {
  const auth = useAuth();
  if (auth.status === 'authenticated' && !auth.displayName) return <DisplayNameScreen />;
  return <Outlet />;
}
