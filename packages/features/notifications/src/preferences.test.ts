import type {
  AcceptanceText,
  ComplianceClient,
  NotificationEntry,
  NotificationPreferences,
  NotificationsClient,
} from '@playhoot/communication';
import { describe, expect, it, vi } from 'vitest';

import { createHistory } from './history';
import { createPreferences } from './preferences';

const ok = <T>(value: T) => ({ ok: true as const, value });
const err = <E>(error: E) => ({ ok: false as const, error });

const preferences: NotificationPreferences = {
  ai: false,
  capacity: false,
  review: true,
  marketing: false,
};

const marketingText: AcceptanceText = {
  kind: 'marketing',
  version: 2,
  language: 'en',
  content: 'news from us',
  publishedAt: '2026-11-16T00:00:00Z',
  accepted: false,
};

const entry = (overrides: Partial<NotificationEntry> = {}): NotificationEntry => ({
  entryUUID: 'e-1',
  sourceDomain: 'identity',
  type: 'welcome',
  skeleton: {},
  email: false,
  necessary: false,
  readAt: null,
  createdAt: '2026-11-16T10:00:00Z',
  ...overrides,
});

function notifications(overrides: Partial<NotificationsClient> = {}): NotificationsClient {
  return {
    list: vi.fn(async () => ok({ unread: 0, entries: [] })),
    listFiltered: vi.fn(async () => ok({ unread: 1, entries: [entry()] })),
    markRead: vi.fn(async () => ok(undefined)),
    readPreferences: vi.fn(async () => ok(preferences)),
    setPreferences: vi.fn(async (next: NotificationPreferences) => ok(next)),
    ...overrides,
  };
}

function compliance(overrides: Partial<ComplianceClient> = {}): ComplianceClient {
  return {
    readText: vi.fn(async () => ok(marketingText)),
    textDownloadUrl: (kind: string) => `/v1/compliance/texts/${kind}?download=1`,
    recordAcceptance: vi.fn(async () => ok('recorded')),
    recordDeclaration: vi.fn(async () => ok({ outcome: 'recorded', thresholdAge: 18 })),
    ...overrides,
  };
}

describe('createHistory', () => {
  it('asks the endpoint for the filter in hand, with a day read inclusively', async () => {
    const client = notifications();
    const history = createHistory({ client });

    await history.setFilter({ domain: 'identity', type: 'welcome', from: '2026-11-01', to: '' });

    const asked = vi.mocked(client.listFiltered).mock.calls.at(-1)?.[0];
    expect(asked).toMatchObject({ domain: 'identity', type: 'welcome' });
    expect(asked?.from).toBe(new Date('2026-11-01T00:00:00').toISOString());
    expect(asked?.to).toBeUndefined();
  });

  it('shows an entry read right away and puts it back when the backend refuses', async () => {
    const client = notifications({
      markRead: vi.fn(async () =>
        err({
          kind: 'unavailable' as const,
          failure: { kind: 'network' as const, message: 'offline' },
        }),
      ),
    });
    const history = createHistory({ client });
    await history.load();

    await history.markRead('e-1');

    expect(history.store.getState()).toMatchObject({
      unread: 1,
      entries: [{ entryUUID: 'e-1', readAt: null }],
    });
  });

  it('marks nothing by reading the list', async () => {
    const client = notifications();
    const history = createHistory({ client });

    await history.load();

    expect(client.markRead).not.toHaveBeenCalled();
  });
});

describe('createPreferences', () => {
  it('sets one optional group and keeps the others as they are', async () => {
    const client = notifications();
    const feature = createPreferences({ client, compliance: compliance() });
    await feature.load();

    expect(await feature.setGroup('ai', true)).toBe(true);

    expect(client.setPreferences).toHaveBeenCalledWith({ ...preferences, ai: true });
  });

  it('records the acceptance at the version read before storing the preference', async () => {
    const client = notifications();
    const texts = compliance();
    const feature = createPreferences({ client, compliance: texts });
    await feature.load();

    expect(await feature.setMarketing(true, 'en')).toBe(true);

    expect(texts.recordAcceptance).toHaveBeenCalledWith(
      'marketing',
      2,
      'en',
      'accepted',
      'preferences',
    );
    expect(client.setPreferences).toHaveBeenCalledWith({ ...preferences, marketing: true });
  });

  it('records the withdrawal when marketing is turned off', async () => {
    const texts = compliance();
    const feature = createPreferences({ client: notifications(), compliance: texts });
    await feature.load();

    await feature.setMarketing(false, 'en');

    expect(texts.recordAcceptance).toHaveBeenCalledWith(
      'marketing',
      2,
      'en',
      'withdrawn',
      'preferences',
    );
  });

  it('stores nothing when the acceptance could not be recorded', async () => {
    const client = notifications();
    const texts = compliance({
      recordAcceptance: vi.fn(async () =>
        err({
          kind: 'unavailable' as const,
          failure: { kind: 'network' as const, message: 'offline' },
        }),
      ),
    });
    const feature = createPreferences({ client, compliance: texts });
    await feature.load();

    expect(await feature.setMarketing(true, 'en')).toBe(false);

    expect(client.setPreferences).not.toHaveBeenCalled();
    expect(feature.store.getState().saveFailed).toBe(true);
  });

  it('asks for nothing when the marketing text is not published yet', async () => {
    const client = notifications();
    const texts = compliance({
      readText: vi.fn(async () => err({ kind: 'not-published' as const })),
    });
    const feature = createPreferences({ client, compliance: texts });
    await feature.load();

    expect(await feature.setMarketing(true, 'en')).toBe(false);

    expect(texts.recordAcceptance).not.toHaveBeenCalled();
    expect(feature.store.getState().marketingTextMissing).toBe(true);
  });
});
