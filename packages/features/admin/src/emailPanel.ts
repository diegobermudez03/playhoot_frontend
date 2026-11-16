import type { AdminClient } from '@playhoot/communication';
import type { EmailStatusResponse } from '@playhoot/protocol';
import { createStore, type StoreApi } from 'zustand/vanilla';

import { adminFailure, type AdminFailure } from './failures';

export interface EmailPanelState {
  status: 'loading' | 'ready' | 'failed';
  email: EmailStatusResponse | null;
  // The mode being set, so only its own control shows itself busy.
  working: string | null;
  // The backend's outcome of the last change (`changed`, `unchanged`), as it wrote it.
  result: string | null;
  actionError: AdminFailure | null;
  error: AdminFailure | null;
}

export interface EmailPanel {
  store: StoreApi<EmailPanelState>;
  refresh(): Promise<void>;
  setMode(mode: string, reason: string): Promise<boolean>;
}

// Outbound email: the mode, per-provider consumption and deliveries by state (P31§2). No body of
// any email is ever read here, because none is stored (P31§5).
export function createEmailPanel(deps: { admin: AdminClient }): EmailPanel {
  const store = createStore<EmailPanelState>(() => ({
    status: 'loading',
    email: null,
    working: null,
    result: null,
    actionError: null,
    error: null,
  }));

  const refresh = async () => {
    const result = await deps.admin.email();
    if (!result.ok) {
      store.setState({ status: 'failed', error: adminFailure(result.error) });
      return;
    }
    store.setState({ status: 'ready', email: result.value, error: null });
  };

  return {
    store,
    refresh,
    async setMode(mode, reason) {
      if (store.getState().working) return false;
      store.setState({ working: mode, result: null, actionError: null });
      const result = await deps.admin.setEmailMode({ mode, reason });
      if (!result.ok) {
        store.setState({ working: null, actionError: adminFailure(result.error) });
        return false;
      }
      store.setState({ working: null, result: result.value, actionError: null });
      await refresh();
      return true;
    },
  };
}
