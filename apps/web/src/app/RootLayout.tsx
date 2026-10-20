import { Outlet } from 'react-router';

// Shell around every route. Platform chrome (header, navigation) goes here when it exists.
export function RootLayout() {
  return <Outlet />;
}
