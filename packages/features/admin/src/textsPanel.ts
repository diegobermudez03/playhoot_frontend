import type { AdminClient } from '@playhoot/communication';
import type {
  PublishedTextResponse,
  PublishTextRequest,
  TextCatalogEntry,
} from '@playhoot/protocol';
import { createStore, type StoreApi } from 'zustand/vanilla';

import { adminFailure, type AdminFailure } from './failures';

export interface TextsPanelState {
  status: 'loading' | 'ready' | 'failed';
  catalog: readonly TextCatalogEntry[];
  working: boolean;
  result: PublishedTextResponse | null;
  actionError: AdminFailure | null;
  error: AdminFailure | null;
}

export interface TextsPanel {
  store: StoreApi<TextsPanelState>;
  refresh(): Promise<void>;
  // True once the version is published. `invalid` comes back in `actionError`.
  publish(request: PublishTextRequest): Promise<boolean>;
}

// The acceptance texts people accept, publishable from admin without a deploy (D-037, P-23).
// Versions are immutable and append-only; the catalog is read again after every publication.
export function createTextsPanel(deps: { admin: AdminClient }): TextsPanel {
  const store = createStore<TextsPanelState>(() => ({
    status: 'loading',
    catalog: [],
    working: false,
    result: null,
    actionError: null,
    error: null,
  }));

  const refresh = async () => {
    const result = await deps.admin.texts();
    if (!result.ok) {
      store.setState({ status: 'failed', error: adminFailure(result.error) });
      return;
    }
    store.setState({ status: 'ready', catalog: result.value.texts, error: null });
  };

  const publish = async (request: PublishTextRequest) => {
    if (store.getState().working) return false;
    store.setState({ working: true, result: null, actionError: null });
    const result = await deps.admin.publishText(request);
    if (!result.ok) {
      store.setState({ working: false, actionError: adminFailure(result.error) });
      return false;
    }
    store.setState({ working: false, result: result.value, actionError: null });
    await refresh();
    return true;
  };

  return { store, refresh, publish };
}
