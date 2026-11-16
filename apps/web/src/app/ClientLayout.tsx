import { Outlet } from 'react-router';

import { DisplayNameScreen } from '../features/sign-in/DisplayNameScreen';
import { ClientOnly } from './ClientOnly';
import { identityKey } from './identityKey';
import { useAuth } from './ServicesContext';

// Everything under this layout is the app as it has always been: it needs the browser (storage,
// the credential, the device, live connections), so the server renders nothing for it and the
// client takes over at hydration (D-019). Public routes that are server-rendered sit outside it
// and share the same services and the same shell, which root.tsx puts above both.
export default function ClientLayout() {
  return (
    <ClientOnly>
      <IdentityGate />
    </ClientOnly>
  );
}

// An account without a display name chooses one before any page shows, however it got there. When
// the person changes (another tab signed in as someone else), every page is rebuilt for the new
// one, so nothing of the previous person (a live connection, a lobby) stays open.
function IdentityGate() {
  const auth = useAuth();
  if (auth.status === 'authenticated' && !auth.displayName) return <DisplayNameScreen />;
  return <Outlet key={identityKey(auth)} />;
}
