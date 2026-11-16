import { operationAccess } from '@playhoot/app-core';
import type { ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';

import { useOperationAccess, useOptionalServices } from '../app/ServicesContext';
import { useLocalePaths } from '../i18n/useLocalePaths';
import type { AuthReason } from './paths';

// Renders `children` only once the person may perform `operation` (backend operation catalog);
// otherwise sends them to the one authentication screen with the reason it was opened, the
// weakest identity that would do, and this address to come back to (B, P14§1).
// UX only: the backend still decides every request.
export function RequireOperation({
  operation,
  reason,
  children,
}: {
  operation: string;
  // What the person was trying to do, so the screen can say it in their language.
  reason: AuthReason;
  children: ReactNode;
}) {
  const access = useOperationAccess(operation);
  const location = useLocation();
  const paths = useLocalePaths();
  if (access.status === 'pending') return null;
  if (access.status === 'allowed') return <>{children}</>;
  // Everything typed so far is in the address, so coming back asks for none of it again
  // (WCAG 2.2 3.3.7).
  const next = location.pathname + location.search;
  return <Navigate to={paths.auth({ reason, level: access.level, next })} replace />;
}

// Goes to `path` to perform `operation`, through the authentication screen first when the person
// cannot yet.
export function useNavigateToOperation(): (
  operation: string,
  path: string,
  reason: AuthReason,
) => void {
  // A server-rendered public page may offer these before the app is interactive (the join entry
  // does). Until then nothing is known about the person, so the person is simply sent to the
  // destination, which gates itself with `RequireOperation` once it has an answer.
  const services = useOptionalServices();
  const navigate = useNavigate();
  const paths = useLocalePaths();
  return (operation, path, reason) => {
    if (!services) {
      void navigate(path);
      return;
    }
    const { auth, operations } = services.app.store.getState();
    const access = operationAccess(auth, operations, operation);
    void navigate(
      access.status === 'needs' ? paths.auth({ reason, level: access.level, next: path }) : path,
    );
  };
}
