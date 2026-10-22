import type { ClientTelemetryEvent } from '@playhoot/protocol';
import { describe, expect, it } from 'vitest';

import type { HttpClient, HttpRequest } from './http';
import { ok } from './result';
import type { Timers } from './sessionConnection';
import { createTelemetryReporter } from './telemetryReporter';

function setup(canSend = true) {
  const sent: Array<HttpRequest<unknown>> = [];
  const http: HttpClient = {
    request: <T>(request: HttpRequest<T>) => {
      sent.push(request as HttpRequest<unknown>);
      return Promise.resolve(ok(undefined as T));
    },
  };
  const scheduled: Array<{ run: () => void; delayMs: number; cancelled: boolean }> = [];
  const timers: Timers = {
    now: () => 0,
    setTimeout: (run, delayMs) => {
      const task = { run, delayMs, cancelled: false };
      scheduled.push(task);
      return task;
    },
    clearTimeout: (handle) => void ((handle as { cancelled: boolean }).cancelled = true),
  };
  const state = { canSend };
  const reporter = createTelemetryReporter({ http, timers, canSend: () => state.canSend });
  const eventsSent = () =>
    sent.map((request) => (request.body as { events: ClientTelemetryEvent[] }).events);
  return { reporter, sent, scheduled, state, eventsSent };
}

describe('createTelemetryReporter', () => {
  it('sends queued events every 30 s, coalescing counted ones', async () => {
    const t = setup();
    t.reporter.record({ name: 'resync' });
    t.reporter.record({ name: 'resync' });
    t.reporter.record({ name: 'connection_lost', close: 'retryable' });
    t.reporter.record({ name: 'resync', count: 3 });
    t.reporter.record({ name: 'game_ready', duration_ms: 80 });
    t.reporter.record({ name: 'game_ready', duration_ms: 90 });
    expect(t.sent).toEqual([]);
    expect(t.scheduled.map((s) => s.delayMs)).toEqual([30_000]);

    t.scheduled[0]!.run();
    await Promise.resolve();

    expect(t.sent[0]).toMatchObject({ method: 'POST', path: '/v1/client-telemetry' });
    expect(t.eventsSent()).toEqual([
      [
        { name: 'resync', count: 5 },
        { name: 'connection_lost', close: 'retryable' },
        { name: 'game_ready', duration_ms: 80 },
        { name: 'game_ready', duration_ms: 90 },
      ],
    ]);
  });

  it('keeps events of different values apart', async () => {
    const t = setup();
    t.reporter.record({ name: 'connection_lost', close: 'retryable' });
    t.reporter.record({ name: 'connection_lost', close: 'replaced' });
    await t.reporter.flush();
    expect(t.eventsSent()[0]).toHaveLength(2);
  });

  it('waits for an identity before sending', async () => {
    const t = setup(false);
    t.reporter.record({ name: 'resync' });
    await t.reporter.flush();
    expect(t.sent).toEqual([]);
    t.state.canSend = true;
    await t.reporter.flush();
    expect(t.eventsSent()).toEqual([[{ name: 'resync' }]]);
  });

  it('sends with keepalive when the page is going away, and nothing when the queue is empty', async () => {
    const t = setup();
    await t.reporter.flush({ leaving: true });
    expect(t.sent).toEqual([]);
    t.reporter.record({ name: 'resync' });
    await t.reporter.flush({ leaving: true });
    expect(t.sent[0]).toMatchObject({ keepalive: true });
  });

  it('sends early when half a batch is waiting, and never queues more than a batch', async () => {
    const t = setup(false);
    for (let i = 0; i < 150; i += 1) t.reporter.record({ name: 'game_ready', duration_ms: i });
    t.state.canSend = true;
    await t.reporter.flush();
    expect(t.eventsSent()[0]).toHaveLength(100);
    for (let i = 0; i < 50; i += 1) t.reporter.record({ name: 'game_ready', duration_ms: i });
    expect(t.sent).toHaveLength(2);
  });

  it('records nothing once disposed', async () => {
    const t = setup();
    t.reporter.dispose();
    t.reporter.record({ name: 'resync' });
    await t.reporter.flush();
    expect(t.sent).toEqual([]);
  });
});
