import { describe, expect, it } from 'vitest';

import {
  createSessionConnector,
  type SessionConnection,
  type SessionConnectionEvent,
  type Timers,
} from './sessionConnection';

class FakeSocket {
  static last: FakeSocket;
  readonly OPEN = 1;
  readyState = 0;
  sent: unknown[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  constructor() {
    FakeSocket.last = this;
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {}
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  receive(message: object) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}

// A manual clock: time only moves when the test says so.
function manualTimers() {
  let now = 0;
  let nextId = 0;
  const scheduled = new Map<number, { at: number; run: () => void }>();
  const timers: Timers = {
    now: () => now,
    setTimeout: (run, delayMs) => {
      nextId += 1;
      scheduled.set(nextId, { at: now + delayMs, run });
      return nextId;
    },
    clearTimeout: (handle) => void scheduled.delete(handle as number),
  };
  const advance = (ms: number) => {
    now += ms;
    for (const [id, task] of [...scheduled].sort((a, b) => a[1].at - b[1].at)) {
      if (task.at <= now) {
        scheduled.delete(id);
        task.run();
      }
    }
  };
  return { timers, advance };
}

function setup() {
  const clock = manualTimers();
  let tokens = 0;
  const result = createSessionConnector({
    realtimeBaseUrl: 'ws://host',
    device: () => 'mobile',
    credentials: { currentToken: () => 't' },
    WebSocket: FakeSocket as unknown as typeof WebSocket,
    timers: clock.timers,
    newCommandToken: () => `tok-${++tokens}`,
  }).connect({ kind: 'session', sessionUUID: 's' });
  if (!result.ok) throw new Error('expected a connection');
  const connection: SessionConnection = result.value;
  const events: SessionConnectionEvent[] = [];
  connection.subscribe((e) => events.push(e));
  const socket = FakeSocket.last;
  socket.open();
  return { connection, socket, events, ...clock };
}

const view = (fields: object) => ({
  type: 'player_view',
  participant_id: 'P1',
  full: false,
  revision: 1,
  state: {},
  consumed_through_sample_sequence: 0,
  ...fields,
});

describe('SessionConnection samples', () => {
  it('numbers samples from 1 and coalesces bursts to the latest snapshot', () => {
    const t = setup();
    t.connection.sample({ move: [1, 0] });
    t.connection.sample({ move: [0, 1] });
    t.connection.sample({ move: [-1, 0] });
    expect(t.socket.sent).toEqual([{ type: 'sample', sequence: 1, inputs: { move: [1, 0] } }]);

    t.advance(17);
    expect(t.socket.sent).toEqual([
      { type: 'sample', sequence: 1, inputs: { move: [1, 0] } },
      { type: 'sample', sequence: 2, inputs: { move: [-1, 0] } },
    ]);
    expect(t.events.filter((e) => e.type === 'sample-sent')).toEqual([
      { type: 'sample-sent', sequence: 1 },
      { type: 'sample-sent', sequence: 2 },
    ]);
  });

  it('never sends a sample over the message size limit', () => {
    const t = setup();
    t.connection.sample({ blob: 'x'.repeat(40_000) });
    expect(t.socket.sent).toEqual([]);
    expect(t.events.at(-1)).toMatchObject({ type: 'protocol-error' });
  });
});

describe('SessionConnection commands', () => {
  it('correlates the result by token', async () => {
    const t = setup();
    const result = t.connection.command('teleport', { x: 1, y: 2 });
    expect(t.socket.sent).toEqual([
      { type: 'command', token: 'tok-1', name: 'teleport', payload: { x: 1, y: 2 } },
    ]);
    t.socket.receive({
      type: 'command_result',
      token: 'tok-1',
      outcome: 'executed',
      response: { ok: true },
    });
    await expect(result).resolves.toEqual({
      token: 'tok-1',
      outcome: 'executed',
      response: { ok: true },
    });
  });

  it('takes an outcome the backend added as unknown, without a protocol error', async () => {
    const t = setup();
    const result = t.connection.command('teleport', { x: 1, y: 2 });
    t.socket.receive({ type: 'command_result', token: 'tok-1', outcome: 'brand_new' });
    await expect(result).resolves.toEqual({ token: 'tok-1', outcome: 'unknown' });
    expect(t.events.some((event) => event.type === 'protocol-error')).toBe(false);
  });

  it('retries rate_limited with the same token, then reports it', async () => {
    const t = setup();
    const result = t.connection.command('boost', null);
    for (const delay of [250, 500, 1000]) {
      t.socket.receive({ type: 'command_result', token: 'tok-1', outcome: 'rate_limited' });
      t.advance(delay);
    }
    expect(t.socket.sent).toHaveLength(4);
    expect(new Set(t.socket.sent.map((m) => (m as { token: string }).token))).toEqual(
      new Set(['tok-1']),
    );
    t.socket.receive({ type: 'command_result', token: 'tok-1', outcome: 'rate_limited' });
    await expect(result).resolves.toEqual({ token: 'tok-1', outcome: 'rate_limited' });
  });

  it('resolves pending commands as connection-closed, keeping the token for a retry', async () => {
    const t = setup();
    const result = t.connection.command('jump', undefined, { token: 'mine' });
    t.socket.onclose?.({ code: 1006, reason: '' });
    await expect(result).resolves.toEqual({ token: 'mine', outcome: 'connection-closed' });
  });

  it('refuses oversized commands without sending them', async () => {
    const t = setup();
    await expect(t.connection.command('say', { text: 'x'.repeat(40_000) })).resolves.toMatchObject({
      outcome: 'too-large',
    });
    expect(t.socket.sent).toEqual([]);
  });
});

describe('SessionConnection views', () => {
  it('emits reconciled state and asks for a resync once per gap', () => {
    const t = setup();
    t.socket.receive(view({ full: true, revision: 1, state: { a: 1, b: 1 } }));
    t.socket.receive(view({ revision: 2, state: { b: 2 } }));
    t.socket.receive(view({ revision: 5, state: { b: 9 } }));
    t.socket.receive(view({ revision: 6, state: { b: 10 } }));
    t.socket.receive(view({ full: true, revision: 7, state: { a: 7, b: 7 } }));
    t.socket.receive(view({ revision: 9, state: { b: 9 } }));

    const updates = t.events
      .filter((e) => e.type === 'view')
      .map((e) => e.type === 'view' && e.update);
    expect(updates.map((u) => u && u.kind)).toEqual([
      'state',
      'state',
      'gap',
      'gap',
      'state',
      'gap',
    ]);
    expect(updates[1]).toMatchObject({ state: { a: 1, b: 2 } });
    expect(t.socket.sent).toEqual([{ type: 'resync' }, { type: 'resync' }]);
  });

  it('needs no resync when the server collapses a lagging connection into a FULL view', () => {
    const t = setup();
    t.socket.receive(view({ full: true, revision: 1, state: { a: 1 } }));
    t.socket.receive(view({ full: true, revision: 40, state: { a: 40 } }));
    t.socket.receive(view({ revision: 41, state: { a: 41 } }));
    expect(t.connection.currentView()).toEqual({ state: { a: 41 }, ack: 0 });
    expect(t.socket.sent).toEqual([]);
  });

  it('sends a game fault unanswered, replacing a detail over the server limit', () => {
    const t = setup();
    expect(t.connection.reportGameFault('bridge_abuse', { refused: { sample: 900 } })).toBe(true);
    t.connection.reportGameFault('container_violation', { detail: 'x'.repeat(3000) });
    expect(t.socket.sent).toEqual([
      { type: 'game_fault', kind: 'bridge_abuse', detail: { refused: { sample: 900 } } },
      { type: 'game_fault', kind: 'container_violation', detail: { truncated: true } },
    ]);
  });

  it('keeps the current view and ack, and none while a gap waits for a FULL view', () => {
    const t = setup();
    expect(t.connection.currentView()).toBeUndefined();
    t.socket.receive(view({ full: true, revision: 1, state: { a: 1 } }));
    t.socket.receive(view({ revision: 2, state: { a: 2 }, consumed_through_sample_sequence: 3 }));
    expect(t.connection.currentView()).toEqual({ state: { a: 2 }, ack: 3 });
    t.socket.receive(view({ revision: 4, state: { a: 4 } }));
    expect(t.connection.currentView()).toBeUndefined();
  });

  it('passes lobby and lifecycle messages through untouched', () => {
    const t = setup();
    t.socket.receive({ type: 'lobby_update', session_uuid: 's', members: [] });
    expect(t.events.at(-1)).toEqual({
      type: 'message',
      message: { type: 'lobby_update', session_uuid: 's', members: [] },
    });
  });
});
