import { Navigate, Outlet, useLocation } from 'react-router';
import { useStore } from 'zustand';

import { useServices } from '../../app/ServicesContext';
import { adminSignInPath } from '../paths';
import { AdminShell } from './AdminShell';

// The four panels behind admin mode. Without a live admin token nothing of them is built: the
// person goes to the admin sign-in, and this very address is what they come back to, so the
// panel's own state — which its URL carries — survives the trip (D-023).
export default function AdminArea() {
  const location = useLocation();
  const { adminSession } = useServices();
  const session = useStore(adminSession.store);
  if (session.status !== 'active') {
    return <Navigate to={adminSignInPath(location.pathname + location.search)} replace />;
  }
  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}
