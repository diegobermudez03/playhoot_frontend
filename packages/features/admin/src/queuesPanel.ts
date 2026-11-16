import type { AdminClient } from '@playhoot/communication';
import { deadTaskNotDeadOutcome, type DeadTaskResponse } from '@playhoot/protocol';
import { createStore, type StoreApi } from 'zustand/vanilla';

import { adminFailure, type AdminFailure } from './failures';

// What the panel has to say about the action just taken. `not-dead` and `gone` are not failures:
// the queue moved on, and the list is refreshed so it shows what is true now.
export type DeadTaskResult = 'retried' | 'cancelled' | 'not-dead' | 'gone';

export interface QueuesPanelState {
  status: 'loading' | 'ready' | 'failed';
  tasks: readonly DeadTaskResponse[];
  // Domains whose queue could not be read. The rest of the list is still true.
  unavailable: readonly string[];
  // The task an action is running on.
  working: string | null;
  // The result of the last action, cleared when another one starts.
  result: DeadTaskResult | null;
  error: AdminFailure | null;
}

export interface QueuesPanel {
  store: StoreApi<QueuesPanelState>;
  refresh(): Promise<void>;
  retry(taskUUID: string): Promise<void>;
  cancel(taskUUID: string): Promise<void>;
}

// Every domain queue's dead tasks, with retry and cancel (V-05, D-014). The list is read again
// after every action, because retrying one task is not the only thing that may have changed.
export function createQueuesPanel(deps: { admin: AdminClient }): QueuesPanel {
  const store = createStore<QueuesPanelState>(() => ({
    status: 'loading',
    tasks: [],
    unavailable: [],
    working: null,
    result: null,
    error: null,
  }));

  const refresh = async () => {
    const result = await deps.admin.deadTasks();
    if (!result.ok) {
      store.setState({ status: 'failed', error: adminFailure(result.error) });
      return;
    }
    store.setState({
      status: 'ready',
      tasks: result.value.tasks,
      unavailable: result.value.unavailable,
      error: null,
    });
  };

  const act = async (
    taskUUID: string,
    apply: (taskUUID: string) => ReturnType<AdminClient['retryDeadTask']>,
    done: DeadTaskResult,
  ) => {
    if (store.getState().working) return;
    store.setState({ working: taskUUID, result: null, error: null });
    const result = await apply(taskUUID);
    if (!result.ok) {
      const error = adminFailure(result.error);
      // A task that is already gone is reported as such, not as a failure, and the list is read
      // again so it stops showing something that is no longer there.
      store.setState({
        working: null,
        ...(error.kind === 'not-found'
          ? { result: 'gone' as const, error: null }
          : { error, result: null }),
      });
      if (error.kind === 'not-found') await refresh();
      return;
    }
    store.setState({
      working: null,
      result: result.value === deadTaskNotDeadOutcome ? 'not-dead' : done,
      error: null,
    });
    await refresh();
  };

  return {
    store,
    refresh,
    retry: (taskUUID) => act(taskUUID, deps.admin.retryDeadTask, 'retried'),
    cancel: (taskUUID) => act(taskUUID, deps.admin.cancelDeadTask, 'cancelled'),
  };
}
