import { operationAccess } from '@playhoot/app-core';
import type { ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';

import { useOperationAccess, useServices } from '../app/ServicesContext';
import { useLocalePaths, type LocalePaths } from '../i18n/useLocalePaths';
import { AppShell } from '../ui';

// Renders `children` only once the person may perform `operation` (backend operation catalog);
// otherwise sends them to the most flexible authentication it allows and back here afterwards.
// UX only: the backend still decides every request.
export function RequireOperation({
  operation,
  children,
}: {
  operation: string;
  children: ReactNode;
}) {
  const access = useOperationAccess(operation);
  const location = useLocation();
  const paths = useLocalePaths();
  if (access.status === 'pending') return <AppShell>{null}</AppShell>;
  if (access.status === 'allowed') return <>{children}</>;
  const next = location.pathname + location.search;
  return <Navigate to={authenticatePath(paths, access.level, next)} replace />;
}

// Goes to `path` to perform `operation`, through sign-in first when the person cannot yet.
export function useNavigateToOperation(): (operation: string, path: string) => void {
  const { app } = useServices();
  const navigate = useNavigate();
  const paths = useLocalePaths();
  return (operation, path) => {
    const { auth, operations } = app.store.getState();
    const access = operationAccess(auth, operations, operation);
    navigate(access.status === 'needs' ? authenticatePath(paths, access.level, path) : path);
  };
}

// The guest page offers the account option too; an operation that needs an account goes straight
// to signing in.
function authenticatePath(paths: LocalePaths, level: 'guest' | 'account', next: string): string {
  return level === 'guest' ? paths.guestSignIn(next) : paths.signIn(next);
}
