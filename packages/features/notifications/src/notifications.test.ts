import { createAppState, type Credential, type CredentialStore } from '@playhoot/app-core';
import type { NotificationEntry, NotificationsClient } from '@playhoot/communication';
import { describe, expect, it, vi } from 'vitest';

import { createNotifications } from './notifications';

const entry = (overrides: Partial<NotificationEntry> = {}): NotificationEntry => ({
  entryUUID: 'e1',
  sourceDomain: 'budget',
  type: 'budget-level-changed',
  skeleton: {},
  email: false,
  necessary: true,
  readAt: null,
  createdAt: '2026-11-15T10:00:00Z',
  ...overrides,
});

function setup(client: Partial<NotificationsClient> = {}) {
  let saved: Credential | null = null;
  const credentials: CredentialStore = {
    load: () => saved,
    save: (credential) => {
      saved = credential;
    },
    clear: () => {
      saved = null;
    },
  };
  const app = createAppState({
    credentials,
    locale: { store: { load: () => null, save: () => undefined }, devicePreferences: () => [] },
  });
  app.bootstrap();
  const full: NotificationsClient = {
    list: vi.fn(async () => ({ ok: true as const, value: { unread: 0, entries: [] } })),
    markRead: vi.fn(async () => ({ ok: true as const, value: undefined })),
    ...client,
  };
  const signIn = () =>
    app.signIn({ kind: 'guest', userUUID: 'u1', displayName: 'Paper Cat', token: 't' });
  return { app, client: full, signIn, notifications: createNotifications({ app, client: full }) };
}

describe('createNotifications', () => {
  it('asks for nothing while nobody is signed in', async () => {
    const { client, notifications } = setup();

    await notifications.refresh();

    expect(client.list).not.toHaveBeenCalled();
    expect(notifications.store.getState()).toEqual({
      status: 'idle',
      unread: 0,
      entries: [],
      error: null,
    });
  });

  it('keeps the unread count and the entries once someone is signed in', async () => {
    const entries = [entry(), entry({ entryUUID: 'e2', readAt: '2026-11-15T11:00:00Z' })];
    const { notifications, signIn } = setup({
      list: vi.fn(async () => ({ ok: true as const, value: { unread: 1, entries } })),
    });
    signIn();

    await notifications.refresh();

    expect(notifications.store.getState()).toEqual({
      status: 'ready',
      unread: 1,
      entries,
      error: null,
    });
  });

  it('reads the list once while a read is already in flight', async () => {
    const { client, notifications, signIn } = setup();
    signIn();

    await Promise.all([notifications.refresh(), notifications.refresh()]);

    expect(client.list).toHaveBeenCalledTimes(1);
  });

  it('keeps what was already read when a refresh fails, and says why', async () => {
    const entries = [entry()];
    let answers = 0;
    const { notifications, signIn } = setup({
      list: vi.fn(async () =>
        answers++ === 0
          ? { ok: true as const, value: { unread: 1, entries } }
          : { ok: false as const, error: { kind: 'busy' as const, retryAfterSeconds: 30 } },
      ),
    });
    signIn();
    await notifications.refresh();

    await notifications.refresh();

    expect(notifications.store.getState()).toEqual({
      status: 'failed',
      unread: 1,
      entries,
      error: { kind: 'busy', retryAfterSeconds: 30 },
    });
  });

  it('shows an entry read at once and lowers the count', async () => {
    const { client, notifications, signIn } = setup({
      list: vi.fn(async () => ({ ok: true as const, value: { unread: 1, entries: [entry()] } })),
    });
    signIn();
    await notifications.refresh();

    await notifications.markRead('e1');

    expect(client.markRead).toHaveBeenCalledWith('e1');
    expect(notifications.store.getState().unread).toBe(0);
    expect(notifications.store.getState().entries[0]!.readAt).not.toBeNull();
  });

  it('shows it unread again when the backend does not take it', async () => {
    const { notifications, signIn } = setup({
      list: vi.fn(async () => ({ ok: true as const, value: { unread: 1, entries: [entry()] } })),
      markRead: vi.fn(async () => ({
        ok: false as const,
        error: {
          kind: 'unavailable' as const,
          failure: { kind: 'network' as const, message: 'offline' },
        },
      })),
    });
    signIn();
    await notifications.refresh();

    await notifications.markRead('e1');

    expect(notifications.store.getState().unread).toBe(1);
    expect(notifications.store.getState().entries[0]!.readAt).toBeNull();
  });

  it('marks an entry it does not hold, or one already read, no further', async () => {
    const { client, notifications, signIn } = setup({
      list: vi.fn(async () => ({
        ok: true as const,
        value: { unread: 0, entries: [entry({ readAt: '2026-11-15T11:00:00Z' })] },
      })),
    });
    signIn();
    await notifications.refresh();

    await notifications.markRead('e1');
    await notifications.markRead('missing');

    expect(client.markRead).not.toHaveBeenCalled();
  });

  it('forgets the list when the person leaves, and drops an answer meant for them', async () => {
    let release = () => undefined as void;
    const { notifications, signIn } = setup({
      list: vi.fn(async () => {
        await new Promise<void>((resolve) => {
          release = () => resolve();
        });
        return { ok: true as const, value: { unread: 3, entries: [entry()] } };
      }),
    });
    signIn();
    const reading = notifications.refresh();

    notifications.clear();
    release();
    await reading;

    expect(notifications.store.getState()).toEqual({
      status: 'idle',
      unread: 0,
      entries: [],
      error: null,
    });
  });
});
