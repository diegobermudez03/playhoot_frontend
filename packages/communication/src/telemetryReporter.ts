import {
  clientTelemetryLimits,
  clientTelemetryPath,
  type ClientTelemetryEvent,
} from '@playhoot/protocol';

import type { HttpClient } from './http';
import type { Timers } from './sessionConnection';

export interface TelemetryReporter {
  // Queues one event; never blocks and never fails.
  record(event: ClientTelemetryEvent): void;
  // Sends what is queued now. `leaving`: the page is going away, so the request must outlive it.
  flush(options?: { leaving?: boolean }): Promise<void>;
  dispose(): void;
}

export interface TelemetryReporterOptions {
  http: HttpClient;
  timers: Timers;
  // Whether a batch can be sent now: the backend needs an identity (any guest's will do). Until
  // then events stay queued.
  canSend: () => boolean;
  flushIntervalMs?: number;
}

export const defaultTelemetryFlushIntervalMs = 30_000;

// Sends the client's telemetry to the backend in batches (plan §17, backend `api/clienttelemetry`):
// at most every 30 s, sooner when half a batch is waiting, and once more as the page goes away.
// Counted events of the same kind are coalesced into one with a count. Best effort: a batch that
// fails is dropped, never retried, and the queue never holds more than one batch.
export function createTelemetryReporter(options: TelemetryReporterOptions): TelemetryReporter {
  const interval = options.flushIntervalMs ?? defaultTelemetryFlushIntervalMs;
  let queue: ClientTelemetryEvent[] = [];
  let timer: unknown = null;
  let disposed = false;

  const schedule = () => {
    if (timer !== null || disposed) return;
    timer = options.timers.setTimeout(() => {
      timer = null;
      void flush();
    }, interval);
  };

  const flush = async (flushOptions?: { leaving?: boolean }) => {
    if (queue.length === 0 || !options.canSend()) return;
    const events = queue;
    queue = [];
    if (timer !== null) options.timers.clearTimeout(timer);
    timer = null;
    await options.http.request({
      method: 'POST',
      path: clientTelemetryPath,
      body: { events },
      response: anyBody,
      ...(flushOptions?.leaving && { keepalive: true }),
    });
  };

  return {
    record(event) {
      if (disposed) return;
      if (!coalesce(queue, event)) {
        if (queue.length >= clientTelemetryLimits.maxEvents) return;
        queue.push({ ...event });
      }
      if (queue.length >= clientTelemetryLimits.maxEvents / 2) void flush();
      else schedule();
    },
    flush,
    dispose() {
      disposed = true;
      if (timer !== null) options.timers.clearTimeout(timer);
      timer = null;
    },
  };
}

// Adds a counted event to the same queued one (same name and values), so a burst is one event.
function coalesce(queue: ClientTelemetryEvent[], event: ClientTelemetryEvent): boolean {
  if ('duration_ms' in event) return false;
  const key = identity(event);
  const same = queue.find((queued) => !('duration_ms' in queued) && identity(queued) === key);
  if (!same) return false;
  const counted = same as { count?: number };
  counted.count = Math.min(
    (counted.count ?? 1) + ((event as { count?: number }).count ?? 1),
    clientTelemetryLimits.maxCount,
  );
  return true;
}

// The event's name and values without its count, in a fixed key order.
function identity(event: ClientTelemetryEvent): string {
  const keys = Object.keys(event)
    .filter((key) => key !== 'count')
    .sort();
  return JSON.stringify(event, keys);
}

const anyBody = { safeParse: (value: unknown) => ({ success: true as const, data: value }) };
