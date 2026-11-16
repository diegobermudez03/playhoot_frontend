import type { AdminClient, SecondFactorClient } from '@playhoot/communication';
import type { BudgetCap, BudgetRate, BudgetStatusResponse } from '@playhoot/protocol';
import { createStore, type StoreApi } from 'zustand/vanilla';

import { adminFailure, type AdminFailure } from './failures';
import { withStepUp } from './stepUp';

// Which sensitive action a confirm step is for (P32§7). Each one asks for its own fresh code.
export type BudgetAction = 'controls' | 'cutoff' | 'reopen';

// What the backend answered the action with, as it wrote it (`shut_down`, `already_shut_down`,
// `reopened`, `applied`...). Presentation shows a known one by name and an unknown one as "done".
export type BudgetOutcome = { action: BudgetAction; outcome: string };

export interface BudgetPanelState {
  status: 'loading' | 'ready' | 'failed';
  budget: BudgetStatusResponse | null;
  // The action whose code is being checked, so only its own confirm step shows itself busy.
  working: BudgetAction | null;
  result: BudgetOutcome | null;
  // The failure of the last action; the loading failure lives in `error` with `status: 'failed'`.
  actionError: AdminFailure | null;
  error: AdminFailure | null;
}

export interface BudgetControlsChange {
  caps?: BudgetCap[];
  rates?: BudgetRate[];
  reason: string;
}

export interface BudgetPanel {
  store: StoreApi<BudgetPanelState>;
  refresh(): Promise<void>;
  // Each action takes the code the person just read from their authenticator. True when it was
  // applied; otherwise the reason is in `actionError`, and `step-up-required` means "ask again".
  setControls(code: string, change: BudgetControlsChange): Promise<boolean>;
  cutoff(code: string, reason: string): Promise<boolean>;
  // No category: the first step out of shutdown, which leaves everything closed at `restricted`.
  // Later steps name the categories to open (P32§7).
  reopen(code: string, categories: readonly string[], reason: string): Promise<boolean>;
}

// The restriction ladder and every cap's window consumption, plus the three actions that change
// them (D-012, D-017). The status is read again after every applied action.
export function createBudgetPanel(deps: {
  admin: AdminClient;
  secondFactor: SecondFactorClient;
}): BudgetPanel {
  const store = createStore<BudgetPanelState>(() => ({
    status: 'loading',
    budget: null,
    working: null,
    result: null,
    actionError: null,
    error: null,
  }));

  const refresh = async () => {
    const result = await deps.admin.budget();
    if (!result.ok) {
      store.setState({ status: 'failed', error: adminFailure(result.error) });
      return;
    }
    store.setState({ status: 'ready', budget: result.value, error: null });
  };

  const run = async (
    action: BudgetAction,
    code: string,
    call: (proof: string) => ReturnType<AdminClient['cutoff']>,
  ) => {
    if (store.getState().working) return false;
    store.setState({ working: action, result: null, actionError: null });
    const result = await withStepUp(deps.secondFactor, code, call);
    if (!result.ok) {
      store.setState({ working: null, actionError: result.error });
      return false;
    }
    store.setState({ working: null, result: { action, outcome: result.value }, actionError: null });
    await refresh();
    return true;
  };

  return {
    store,
    refresh,
    setControls: (code, change) =>
      run('controls', code, (proof) =>
        deps.admin.setControls({
          ...(change.caps?.length && { caps: change.caps }),
          ...(change.rates?.length && { rates: change.rates }),
          reason: change.reason,
          step_up_proof: proof,
        }),
      ),
    cutoff: (code, reason) =>
      run('cutoff', code, (proof) => deps.admin.cutoff({ reason, step_up_proof: proof })),
    reopen: (code, categories, reason) =>
      run('reopen', code, (proof) =>
        deps.admin.reopen({
          ...(categories.length > 0 && { categories: [...categories] }),
          reason,
          step_up_proof: proof,
        }),
      ),
  };
}

// Every category the status mentions, in one list: the caps, the rates, the usage rows and the
// ladder. The backend owns the set, so it is read from the answer and never written down here.
export function budgetCategories(budget: BudgetStatusResponse | null): string[] {
  if (!budget) return [];
  const found = new Set<string>();
  for (const cap of budget.caps) if (cap.scope !== globalScope) found.add(cap.scope);
  for (const usage of budget.usage) if (usage.scope !== globalScope) found.add(usage.scope);
  for (const rate of budget.rates) found.add(rate.category);
  for (const category of budget.ladder.paused_categories) found.add(category);
  for (const category of budget.ladder.reopen_closed) found.add(category);
  for (const category of budget.rate_missing) found.add(category);
  return [...found].sort();
}

// The scope that is not a category: everything together.
export const globalScope = 'global';
