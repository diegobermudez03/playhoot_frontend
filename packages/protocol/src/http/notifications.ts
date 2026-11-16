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
