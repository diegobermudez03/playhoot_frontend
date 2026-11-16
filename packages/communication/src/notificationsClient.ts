import {
  markNotificationReadPath,
  markNotificationReadSchema,
  notificationListSchema,
  notificationsPath,
  rateLimitedCode,
} from '@playhoot/protocol';

import type { HttpClient, HttpFailure } from './http';
import { err, ok, type Result } from './result';

// A person's notification entries and their read state (P14§4). Sending is the backend's
// business; this client only reads the list and marks an entry read.

export interface NotificationEntry {
  entryUUID: string;
  // The domain the event came from, and what kind of event it is, as the backend names them.
  // Both are open lists: an unknown type is shown as a notification, never dropped.
  sourceDomain: string;
  type: string;
  // The values the type allows to travel with it (a budget level, a game's name).
  skeleton: Record<string, unknown>;
  // The same event also went out by email.
  email: boolean;
  // A notice the person cannot turn off (security, service, billing).
  necessary: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationList {
  unread: number;
  entries: NotificationEntry[];
}

export type NotificationsFailure =
  // Nobody is signed in, or the credential no longer stands for anyone.
  | { kind: 'unauthenticated' }
  | { kind: 'not-found' }
  | { kind: 'busy'; retryAfterSeconds: number | undefined }
  | { kind: 'unavailable'; failure: HttpFailure };

export interface NotificationsClient {
  list(limit?: number): Promise<Result<NotificationList, NotificationsFailure>>;
  // Marks one entry read. Already-read entries answer the same way.
  markRead(entryUUID: string): Promise<Result<void, NotificationsFailure>>;
}

export function createNotificationsClient(http: HttpClient): NotificationsClient {
  return {
    async list(limit) {
      const query = limit ? `?${new URLSearchParams({ limit: String(limit) }).toString()}` : '';
      const result = await http.request({
        method: 'GET',
        path: notificationsPath + query,
        response: notificationListSchema,
      });
      if (!result.ok) return err(notificationsFailure(result.error));
      return ok({
        unread: result.value.unread,
        entries: result.value.entries.map((entry) => ({
          entryUUID: entry.entry_uuid,
          sourceDomain: entry.source_domain,
          type: entry.type,
          skeleton: entry.skeleton ?? {},
          email: entry.email,
          necessary: entry.necessary,
          readAt: entry.read_at ?? null,
          createdAt: entry.created_at,
        })),
      });
    },

    async markRead(entryUUID) {
      const result = await http.request({
        method: 'POST',
        path: markNotificationReadPath(entryUUID),
        response: markNotificationReadSchema,
      });
      return result.ok ? ok(undefined) : err(notificationsFailure(result.error));
    },
  };
}

export function notificationsFailure(failure: HttpFailure): NotificationsFailure {
  if (failure.kind !== 'http') return { kind: 'unavailable', failure };
  if (failure.status === 401 || failure.status === 403) return { kind: 'unauthenticated' };
  if (failure.status === 404) return { kind: 'not-found' };
  if (failure.code === rateLimitedCode || failure.status === 429 || failure.status === 503) {
    return { kind: 'busy', retryAfterSeconds: failure.retryAfterSeconds };
  }
  return { kind: 'unavailable', failure };
}
