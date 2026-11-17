import type { NotificationEntry, NotificationsClient } from '@playhoot/communication';
import { notificationsPageLimit, type NotificationFilter } from '@playhoot/protocol';
import { createStore, type StoreApi } from 'zustand/vanilla';

// The full notification history the bell panel abbreviates (P14§4): the same entries with the
// endpoint's filters. Opening this list marks nothing read — an entry is marked when its content
// is opened or the person marks it explicitly — and a type this build does not know is still
// shown, never dropped.

export type HistoryError =
  | { kind: 'unauthenticated' }
  | { kind: 'busy'; retryAfterSeconds: number | undefined }
  | { kind: 'unavailable' };

// What the person narrowed the list to. Empty values mean "everything".
export interface HistoryFilter {
  domain: string;
  type: string;
  from: string;
  to: string;
}

export const everything: HistoryFilter = { domain: '', type: '', from: '', to: '' };

export interface HistoryState {
  status: 'loading' | 'ready' | 'failed';
  unread: number;
  entries: readonly NotificationEntry[];
  filter: HistoryFilter;
  error: HistoryError | null;
}

export interface HistoryDeps {
  client: NotificationsClient;
  // How many entries one page asks for.
  limit?: number;
}

export interface History {
  store: StoreApi<HistoryState>;
  // Reads the list with the filter in hand. Never runs twice at once.
  load(): Promise<void>;
  // Narrows the list and reads it again.
  setFilter(filter: HistoryFilter): Promise<void>;
  // Marks one entry read, showing it read right away; a refusal puts it back as it was.
  markRead(entryUUID: string): Promise<void>;
}

export function createHistory(deps: HistoryDeps): History {
  const limit = deps.limit ?? notificationsPageLimit;
  const store = createStore<HistoryState>(() => ({
    status: 'loading',
    unread: 0,
    entries: [],
    filter: everything,
    error: null,
  }));
  let inFlight: Promise<void> | null = null;

  const read = async (): Promise<void> => {
    const filter = store.getState().filter;
    store.setState((state) => ({ ...state, status: 'loading', error: null }));
    const request: NotificationFilter = { limit };
    if (filter.domain) request.domain = filter.domain;
    if (filter.type) request.type = filter.type;
    // The endpoint bounds the instant an entry was created; a day is read from its first moment
    // to the first moment of the next one, in this browser's own time zone (P14§3).
    const from = startOfDay(filter.from);
    const to = startOfNextDay(filter.to);
    if (from) request.from = from;
    if (to) request.to = to;
    const result = await deps.client.listFiltered(request);
    if (result.ok) {
      store.setState((state) => ({
        ...state,
        status: 'ready',
        unread: result.value.unread,
        entries: result.value.entries,
        error: null,
      }));
      return;
    }
    const failure = result.error;
    const error: HistoryError =
      failure.kind === 'unauthenticated'
        ? { kind: 'unauthenticated' }
        : failure.kind === 'busy'
          ? { kind: 'busy', retryAfterSeconds: failure.retryAfterSeconds }
          : { kind: 'unavailable' };
    store.setState((state) => ({ ...state, status: 'failed', error }));
  };

  const load = (): Promise<void> => {
    inFlight ??= read().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };

  return {
    store,
    load,

    setFilter(filter) {
      store.setState((state) => ({ ...state, filter }));
      return load();
    },

    async markRead(entryUUID) {
      const entry = store.getState().entries.find((candidate) => candidate.entryUUID === entryUUID);
      if (!entry || entry.readAt !== null) return;
      const readAt = new Date().toISOString();
      const mark = (at: string | null) => {
        store.setState((state) => ({
          ...state,
          unread: Math.max(0, at === null ? state.unread + 1 : state.unread - 1),
          entries: state.entries.map((candidate) =>
            candidate.entryUUID === entryUUID ? { ...candidate, readAt: at } : candidate,
          ),
        }));
      };
      mark(readAt);
      const result = await deps.client.markRead(entryUUID);
      // The backend did not take it: show it unread again rather than claim it was read.
      if (!result.ok) mark(null);
    },
  };
}

// A date as the person typed it (YYYY-MM-DD), from its first moment in their own time zone.
function startOfDay(day: string): string | undefined {
  if (!day) return undefined;
  const at = new Date(`${day}T00:00:00`);
  return Number.isNaN(at.getTime()) ? undefined : at.toISOString();
}

// The same date read inclusively: up to the first moment of the next day.
function startOfNextDay(day: string): string | undefined {
  if (!day) return undefined;
  const at = new Date(`${day}T00:00:00`);
  if (Number.isNaN(at.getTime())) return undefined;
  at.setDate(at.getDate() + 1);
  return at.toISOString();
}
