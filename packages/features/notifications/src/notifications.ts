import type { AppState } from '@playhoot/app-core';
import type { NotificationEntry, NotificationsClient } from '@playhoot/communication';
import { notificationsPanelLimit } from '@playhoot/protocol';
import { createStore, type StoreApi } from 'zustand/vanilla';

// The shell's notifications: the unread count behind the bell and the plain list the panel shows.
// One event is one entry however many channels carried it, and the count never grows with a
// retry (P14§4). Opening the panel marks nothing: an entry is marked read when its content is
// opened or the person marks it explicitly.

// Why the list could not be read. Presentation turns each into text in the person's language.
export type NotificationsError =
  // The backend does not accept this credential for notifications (signed out meanwhile).
  | { kind: 'unauthenticated' }
  | { kind: 'busy'; retryAfterSeconds: number | undefined }
  | { kind: 'unavailable' };

export interface NotificationsState {
  // `idle` while nobody is signed in: there is nothing to read and nothing is asked for.
  status: 'idle' | 'loading' | 'ready' | 'failed';
  unread: number;
  // Newest first, as the backend orders them.
  entries: NotificationEntry[];
  error: NotificationsError | null;
}

export interface NotificationsDeps {
  app: AppState;
  client: NotificationsClient;
  // How many entries the panel asks for at once.
  limit?: number;
}

export interface Notifications {
  store: StoreApi<NotificationsState>;
  // Reads the list again. Does nothing while nobody is signed in, and never runs twice at once.
  refresh(): Promise<void>;
  // Marks one entry read, showing it read right away; a refusal puts the list back as it was.
  markRead(entryUUID: string): Promise<void>;
  // Forgets everything read for the person who just left.
  clear(): void;
}

const empty: NotificationsState = { status: 'idle', unread: 0, entries: [], error: null };

export function createNotifications(deps: NotificationsDeps): Notifications {
  const store = createStore<NotificationsState>(() => ({ ...empty }));
  const limit = deps.limit ?? notificationsPanelLimit;
  // Changes whenever the person changes or the list is cleared: an answer for an earlier one is
  // dropped instead of being shown to whoever is signed in now.
  let generation = 0;
  let inFlight: Promise<void> | null = null;

  const signedIn = () => {
    const status = deps.app.store.getState().auth.status;
    return status === 'guest' || status === 'authenticated';
  };

  const read = async (): Promise<void> => {
    const startedFor = generation;
    store.setState((state) => ({ ...state, status: 'loading', error: null }));
    const result = await deps.client.list(limit);
    if (generation !== startedFor) return;
    if (result.ok) {
      store.setState({
        status: 'ready',
        unread: result.value.unread,
        entries: result.value.entries,
        error: null,
      });
      return;
    }
    const failure = result.error;
    const error: NotificationsError =
      failure.kind === 'unauthenticated'
        ? { kind: 'unauthenticated' }
        : failure.kind === 'busy'
          ? { kind: 'busy', retryAfterSeconds: failure.retryAfterSeconds }
          : { kind: 'unavailable' };
    // What was already read stays on screen: a failed refresh empties nothing.
    store.setState((state) => ({ ...state, status: 'failed', error }));
  };

  return {
    store,

    refresh() {
      if (!signedIn()) {
        generation++;
        store.setState({ ...empty });
        return Promise.resolve();
      }
      inFlight ??= read().finally(() => {
        inFlight = null;
      });
      return inFlight;
    },

    async markRead(entryUUID) {
      const before = store.getState();
      const entry = before.entries.find((candidate) => candidate.entryUUID === entryUUID);
      if (!entry || entry.readAt !== null) return;
      const startedFor = generation;
      const readAt = new Date().toISOString();
      store.setState((state) => ({
        ...state,
        unread: Math.max(0, state.unread - 1),
        entries: state.entries.map((candidate) =>
          candidate.entryUUID === entryUUID ? { ...candidate, readAt } : candidate,
        ),
      }));
      const result = await deps.client.markRead(entryUUID);
      if (result.ok || generation !== startedFor) return;
      // The backend did not take it: show it unread again rather than claim it was read.
      store.setState((state) => ({
        ...state,
        unread: state.unread + 1,
        entries: state.entries.map((candidate) =>
          candidate.entryUUID === entryUUID ? { ...candidate, readAt: null } : candidate,
        ),
      }));
    },

    clear() {
      generation++;
      store.setState({ ...empty });
    },
  };
}
