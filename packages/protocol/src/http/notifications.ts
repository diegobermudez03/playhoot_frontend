import { z } from 'zod';

// A person's notification entries (backend `api/notifications/handler.go`, P14§4). One event is
// one logical entry however many channels carried it; sending an email never marks it read, and
// opening the list marks nothing. The entry is marked read when its content is opened or the
// person marks it explicitly.

export const notificationsPath = '/v1/notifications';
export const markNotificationReadPath = (entryUUID: string) =>
  `${notificationsPath}/${encodeURIComponent(entryUUID)}/read`;

// What the panel asks for at once. The backend keeps its own ceiling.
export const notificationsPanelLimit = 20;

// `type` and `source_domain` are the backend's; it may send values this client does not know, and
// an unknown one is still shown as a notification (never dropped, never guessed at).
export const notificationEntrySchema = z.object({
  entry_uuid: z.string().min(1),
  source_domain: z.string(),
  type: z.string(),
  // What the entry is about, as the type documents it. Only values the type allows ever travel.
  skeleton: z.record(z.string(), z.unknown()).nullish(),
  // Whether this event also went out by email, and whether it is a necessary notice.
  email: z.boolean(),
  necessary: z.boolean(),
  read_at: z.string().nullish(),
  created_at: z.string(),
});

export const notificationListSchema = z.object({
  unread: z.number().int().nonnegative(),
  entries: z.array(notificationEntrySchema),
});

export const markNotificationReadSchema = z.object({ outcome: z.string() });

export type NotificationEntryResponse = z.infer<typeof notificationEntrySchema>;
export type NotificationListResponse = z.infer<typeof notificationListSchema>;

// What the history page may ask of the list. `domain` and `type` are the backend's own open
// values; `from`/`to` bound when the entry was created, and `limit` caps one page.
export interface NotificationFilter {
  domain?: string;
  type?: string;
  from?: string;
  to?: string;
  before?: string;
  limit?: number;
}

// The most entries one page asks for; the backend keeps its own ceiling (100).
export const notificationsPageLimit = 50;

export function notificationsQuery(filter: NotificationFilter): string {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(filter)) {
    if (value !== undefined && value !== '') query.set(name, String(value));
  }
  const search = query.toString();
  return search ? `${notificationsPath}?${search}` : notificationsPath;
}

// GET/PUT /v1/notifications/preferences (Bearer, account): the optional email groups and the
// marketing choice (P31§4, V-07). Access, security and billing email is necessary and is not
// here: it cannot be turned off, and in-app notifications are never trimmed by any of this.
export const notificationPreferencesPath = '/v1/notifications/preferences';

export const notificationPreferencesSchema = z.object({
  ai_email: z.boolean(),
  capacity_email: z.boolean(),
  review_email: z.boolean(),
  marketing_email: z.boolean(),
});

export type NotificationPreferencesResponse = z.infer<typeof notificationPreferencesSchema>;

// The optional groups as this build names them; marketing is apart, because turning it on or off
// is an acceptance or a withdrawal of its text (D-037).
export const optionalEmailGroups = ['ai', 'capacity', 'review'] as const;
export type OptionalEmailGroup = (typeof optionalEmailGroups)[number];
