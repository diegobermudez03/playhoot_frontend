import type { AdminClient } from '@playhoot/communication';
import type { MarketsResponse, SetMarketRuleRequest } from '@playhoot/protocol';
import { createStore, type StoreApi } from 'zustand/vanilla';

import { adminFailure, type AdminFailure } from './failures';

export interface MarketsPanelState {
  status: 'loading' | 'ready' | 'failed';
  matrix: MarketsResponse | null;
  working: boolean;
  // The backend's own word for what appending left recorded (`recorded`).
  result: string | null;
  actionError: AdminFailure | null;
  error: AdminFailure | null;
}

export interface MarketsPanel {
  store: StoreApi<MarketsPanelState>;
  refresh(): Promise<void>;
  // True once the rule is recorded. `conditions_pending` and `invalid` come back in
  // `actionError`, leaving what was typed in place.
  appendRule(rule: SetMarketRuleRequest): Promise<boolean>;
}

// The market-and-function matrix over the H1 endpoints (D-038): current rules, scheduled ones
// and history, and appending a change. The matrix is read again after every append.
export function createMarketsPanel(deps: { admin: AdminClient }): MarketsPanel {
  const store = createStore<MarketsPanelState>(() => ({
    status: 'loading',
    matrix: null,
    working: false,
    result: null,
    actionError: null,
    error: null,
  }));

  const refresh = async () => {
    const result = await deps.admin.markets();
    if (!result.ok) {
      store.setState({ status: 'failed', error: adminFailure(result.error) });
      return;
    }
    store.setState({ status: 'ready', matrix: result.value, error: null });
  };

  const appendRule = async (rule: SetMarketRuleRequest) => {
    if (store.getState().working) return false;
    store.setState({ working: true, result: null, actionError: null });
    const result = await deps.admin.setMarketRule(rule);
    if (!result.ok) {
      store.setState({ working: false, actionError: adminFailure(result.error) });
      return false;
    }
    store.setState({ working: false, result: result.value, actionError: null });
    await refresh();
    return true;
  };

  return { store, refresh, appendRule };
}
