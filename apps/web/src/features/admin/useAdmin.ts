import type { AdminFailure } from '@playhoot/feature-admin';
import { endsAdminMode } from '@playhoot/feature-admin';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';

import { useServices } from '../../app/ServicesContext';
import { adminSignInPath } from '../paths';

type PanelState<P> = P extends { store: StoreApi<infer S> } ? S : never;

// Builds a panel once per visit to its screen, reads it immediately, and sends the person back to
// the admin sign-in with this very address as `next` if the admin token lapsed meanwhile: the
// panel's state is in the URL, so coming back restores it (D-023).
export function useAdminPanel<
  P extends { store: StoreApi<{ error: AdminFailure | null }>; refresh: () => Promise<void> },
>(create: () => P): { panel: P; state: PanelState<P> } {
  const [panel] = useState(create);
  // The constraint says only what this hook itself needs (an `error`); the caller gets back the
  // whole state its own panel keeps, which TypeScript cannot carry through the constraint.
  const state = useStore(panel.store) as PanelState<P>;
  useEffect(() => {
    void panel.refresh();
  }, [panel]);
  useSignedOutGuard(state.error);
  return { panel, state };
}

// Admin mode is over, whichever call found out: leave for the sign-in, remembering where we were.
export function useSignedOutGuard(failure: AdminFailure | null): void {
  const navigate = useNavigate();
  const { adminSession } = useServices();
  useEffect(() => {
    if (!failure || !endsAdminMode(failure)) return;
    adminSession.release();
    const here = window.location.pathname + window.location.search;
    void navigate(adminSignInPath(here), { replace: true });
  }, [failure, navigate, adminSession]);
}
