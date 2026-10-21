import type {
  CommandResult,
  SessionConnectionEvent,
  Timers,
  ViewUpdate,
} from '@playhoot/communication';
import { createPlayhoot, type Playhoot } from '@playhoot/game-sdk';
import type { HostToGameMessage } from '@playhoot/protocol/bridge';
import { describe, expect, it } from 'vitest';

import { createArtifactLoader, createMemoryArtifactCache, sha256Hex } from './artifact';
import {
  createAckTranslator,
  startGameHost,
  type GameContainer,
  type GameHostEvent,
  type GameSessionPort,
} from './gameHost';

const html = '<!doctype html><title>game</title>';
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

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

// A Session connection the test drives: views and sample-sent events are pushed by hand.
function fakeSession(initial?: { state: unknown; ack: number }) {
  const listeners = new Set<(event: SessionConnectionEvent) => void>();
  const samples: Record<string, unknown>[] = [];
  const commands: Array<{ name: string; payload: unknown; answer(result: CommandResult): void }> =
    [];
  const port: GameSessionPort = {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    sample: (inputs) => void samples.push(inputs),
    command: (name, payload) => new Promise((answer) => commands.push({ name, payload, answer })),
    currentView: () => initial,
  };
  const emit = (event: SessionConnectionEvent) => listeners.forEach((l) => l(event));
  return { port, samples, commands, emit, listeners };
}

// A container that runs the real SDK in the same process, wired to the Host's handlers.
function sdkContainer() {
  const toGame = new Set<(message: unknown) => void>();
  const sentToGame: HostToGameMessage[] = [];
  let game: Playhoot | null = null;
  let toHost: ((raw: unknown) => void) | null = null;
  let violation: ((detail: string) => void) | null = null;
  let disposed = false;
  let openedWith: string | null = null;
  const container: GameContainer = {
    open(content, handlers) {
      openedWith = content;
      toHost = handlers.onMessage;
      violation = handlers.onViolation;
      game = createPlayhoot({
        post: (message) => queueMicrotask(() => toHost?.(structuredClone(message))),
        listen(handler) {
          toGame.add(handler);
          return () => toGame.delete(handler);
        },
      });
      return {
        send(message) {
          sentToGame.push(message);
          queueMicrotask(() => toGame.forEach((handler) => handler(structuredClone(message))));
        },
        dispose: () => void (disposed = true),
      };
    },
  };
  return {
    container,
    sentToGame,
    game: () => {
      if (!game) throw new Error('container not opened');
      return game;
    },
    postRaw: (raw: unknown) => toHost?.(raw),
    violate: (detail: string) => violation?.(detail),
    get disposed() {
      return disposed;
    },
    get openedWith() {
      return openedWith;
    },
  };
}

async function setup(options: { initial?: { state: unknown; ack: number } } = {}) {
  const sha256 = await sha256Hex(new TextEncoder().encode(html));
  const fetched: string[] = [];
  const loader = createArtifactLoader({
    cache: createMemoryArtifactCache(),
    fetch: (url) => {
      fetched.push(String(url));
      return Promise.resolve(new Response(html));
    },
  });
  const clock = manualTimers();
  const session = fakeSession(options.initial);
  const box = sdkContainer();
  const assets = new Map([['ship', { mimeType: 'image/svg+xml', bytes: new ArrayBuffer(3) }]]);
  const host = startGameHost({
    artifact: { url: 'https://storage/game?sig=1', sha256 },
    loader,
    container: box.container,
    session: session.port,
    context: { participantId: 'p1', participants: ['p1', 'p2'], locale: 'es' },
    assets: { resolve: (key) => Promise.resolve(assets.get(key) ?? null) },
    timers: clock.timers,
  });
  const events: GameHostEvent[] = [];
  host.subscribe((event) => events.push(event));
  for (let i = 0; i < 20 && host.status.phase === 'loading'; i += 1) await flush();
  return { host, session, box, events, fetched, ...clock };
}

const stateUpdate = (state: unknown, ack: number, full = false): ViewUpdate => ({
  kind: 'state',
  full,
  state,
  revision: 1,
  ack,
  events: [],
  errors: [],
});

describe('startGameHost', () => {
  it('loads the verified artifact into the container and waits for READY', async () => {
    const { host, box } = await setup();
    expect(box.openedWith).toBe(html);
    expect(host.status).toEqual({ phase: 'starting' });
  });

  it('answers READY with the context and the current projection, translated', async () => {
    const { host, box } = await setup({ initial: { state: { x: 1 }, ack: 0 } });
    const projections: unknown[] = [];
    box.game().onProjection((projection) => projections.push(projection));
    const context = await box.game().ready();
    await flush();
    expect(context).toEqual({ participantId: 'p1', participants: ['p1', 'p2'], locale: 'es' });
    expect(projections).toEqual([{ state: { x: 1 }, full: true, ack: 0 }]);
    expect(host.status).toEqual({ phase: 'running', version: 1 });
  });

  it('starts without a projection when the Session has none yet', async () => {
    const { box } = await setup();
    await box.game().ready();
    expect(box.sentToGame[0]).toMatchObject({ type: 'start', projection: null });
  });

  it('forwards samples and translates the ack into the game sample ids', async () => {
    const { box, session } = await setup();
    const game = box.game();
    const updates: unknown[] = [];
    game.onUpdate((update) => updates.push(update));
    await game.ready();
    game.sample({ move: [1, 0] });
    game.sample({ move: [0, 1] });
    await flush();
    expect(session.samples).toEqual([{ move: [1, 0] }, { move: [0, 1] }]);
    // The connection sent only the latest one (coalesced) as its sequence 1.
    session.emit({ type: 'sample-sent', sequence: 1 });
    session.emit({ type: 'view', update: stateUpdate({ x: 2 }, 1) });
    await flush();
    expect(updates).toEqual([
      { projection: { state: { x: 2 }, full: false, ack: 2 }, ack: 2, events: [], errors: [] },
    ]);
  });

  it('on a new connection, sends the last inputs again once attached and keeps acks in game ids', async () => {
    const { box, session } = await setup();
    const game = box.game();
    const updates: Array<{ ack: number; projection?: { full: boolean } }> = [];
    game.onUpdate((update) => updates.push(update));
    await game.ready();
    game.sample({ move: [1, 0] });
    await flush();
    session.emit({ type: 'sample-sent', sequence: 1 });
    session.emit({ type: 'view', update: stateUpdate({ x: 1 }, 1) });
    // The connection drops and a new one opens: its sequences start at 1 again.
    session.emit({ type: 'open' });
    expect(session.samples).toHaveLength(1);
    session.emit({ type: 'view', update: stateUpdate({ x: 1 }, 0, true) });
    expect(session.samples).toEqual([{ move: [1, 0] }, { move: [1, 0] }]);
    session.emit({ type: 'sample-sent', sequence: 1 });
    session.emit({ type: 'view', update: stateUpdate({ x: 2 }, 1) });
    await flush();
    expect(updates.map((u) => [u.ack, u.projection?.full])).toEqual([
      [1, false],
      [1, true],
      [1, false],
    ]);
  });

  it('delivers events and errors once, also when the view is a gap', async () => {
    const { box, session } = await setup();
    const game = box.game();
    const events: unknown[] = [];
    const errors: unknown[] = [];
    const projections: unknown[] = [];
    game.onEvent((event) => events.push(event));
    game.onError((error) => errors.push(error));
    game.onProjection((projection) => projections.push(projection));
    await game.ready();
    session.emit({
      type: 'view',
      update: { kind: 'gap', ack: 0, events: [{ type: 'SHIP_ADRIFT' }], errors: ['E'] },
    });
    await flush();
    expect(events).toEqual([{ type: 'SHIP_ADRIFT' }]);
    expect(errors).toEqual(['E']);
    expect(projections).toEqual([]);
  });

  it('runs commands without exposing tokens and maps their outcomes', async () => {
    const { box, session } = await setup();
    const game = box.game();
    await game.ready();
    const executed = game.command('teleport', { x: 100, y: 200 });
    const invalid = game.command('fly');
    const lost = game.command('teleport', { x: 1, y: 1 });
    await flush();
    expect(session.commands.map((c) => [c.name, c.payload])).toEqual([
      ['teleport', { x: 100, y: 200 }],
      ['fly', undefined],
      ['teleport', { x: 1, y: 1 }],
    ]);
    session.commands[0]?.answer({ token: 't1', outcome: 'executed', response: { ok: true } });
    session.commands[1]?.answer({ token: 't2', outcome: 'invalid' });
    session.commands[2]?.answer({ token: 't3', outcome: 'connection-closed' });
    expect(await executed).toEqual({ outcome: 'executed', response: { ok: true } });
    expect(await invalid).toEqual({ outcome: 'rejected' });
    expect(await lost).toEqual({ outcome: 'unavailable' });
    expect(JSON.stringify(box.sentToGame)).not.toContain('t1');
  });

  it('resolves assets by key and refuses unknown keys', async () => {
    const { box } = await setup();
    const game = box.game();
    await game.ready();
    await expect(game.requestAsset('ship')).resolves.toMatch(/^blob:/);
    await expect(game.requestAsset('dragon')).rejects.toThrow('no asset "dragon"');
  });

  it('rejects and records invalid messages without stopping', async () => {
    const { host, box, session, events } = await setup();
    box.postRaw({ bridge: 'playhoot.bridge', type: 'sample', id: 1, inputs: {} });
    await box.game().ready();
    box.postRaw({ bridge: 'playhoot.bridge', type: 'command', id: 1, name: 'x', token: 'mine' });
    box.postRaw({ bridge: 'playhoot.bridge', type: 'sample', id: 1, inputs: 'nope' });
    box.postRaw({ bridge: 'playhoot.bridge', type: 'sample', id: 5, inputs: {} });
    box.postRaw({ bridge: 'playhoot.bridge', type: 'sample', id: 4, inputs: {} });
    box.postRaw({ bridge: 'playhoot.bridge', type: 'ready', versions: [1] });
    box.postRaw({ hello: 'from another script' });
    const big = 'x'.repeat(33 * 1024);
    box.postRaw({ bridge: 'playhoot.bridge', type: 'sample', id: 9, inputs: { big } });
    expect(events.filter((e) => e.type === 'bridge-rejected')).toEqual([
      { type: 'bridge-rejected', detail: 'sample before ready' },
      { type: 'bridge-rejected', detail: 'invalid command message' },
      { type: 'bridge-rejected', detail: 'invalid sample message' },
      { type: 'bridge-rejected', detail: 'sample id not increasing' },
      { type: 'bridge-rejected', detail: 'ready after the game started' },
      { type: 'bridge-rejected', detail: 'message over the size limit' },
    ]);
    expect(session.samples).toEqual([{}]);
    expect(host.status.phase).toBe('running');
  });

  it('fails when the game never says READY', async () => {
    const { host, box, advance } = await setup();
    advance(10_000);
    expect(host.status).toEqual({ phase: 'failed', error: { kind: 'ready-timeout' } });
    expect(box.disposed).toBe(true);
  });

  it('fails without a common bridge version and tells the game', async () => {
    const { host, box } = await setup();
    box.postRaw({ bridge: 'playhoot.bridge', type: 'ready', versions: [99] });
    expect(host.status).toEqual({
      phase: 'failed',
      error: { kind: 'unsupported-bridge-version', offered: [99] },
    });
    expect(box.sentToGame).toEqual([
      { bridge: 'playhoot.bridge', type: 'incompatible', supported: [1] },
    ]);
  });

  it('fails when the game breaks out of its container', async () => {
    const { host, box } = await setup();
    await box.game().ready();
    box.violate('the game navigated away');
    expect(host.status).toEqual({
      phase: 'failed',
      error: { kind: 'container-violation', detail: 'the game navigated away' },
    });
    expect(box.disposed).toBe(true);
  });

  it('stops forwarding and closes the container on dispose', async () => {
    const { host, box, session } = await setup();
    await box.game().ready();
    host.dispose();
    expect(box.disposed).toBe(true);
    expect(session.listeners.size).toBe(0);
    expect(host.status).toEqual({ phase: 'disposed' });
  });

  it('reports load and READY times', async () => {
    const { box, events, advance } = await setup();
    advance(250);
    await box.game().ready();
    expect(events.filter((e) => e.type === 'metric')).toEqual([
      { type: 'metric', name: 'artifact-load-ms', valueMs: 0 },
      { type: 'metric', name: 'ready-ms', valueMs: 250 },
    ]);
  });
});

describe('createArtifactLoader', () => {
  const ref = async (content: string) => ({
    url: 'https://storage/a?sig',
    sha256: await sha256Hex(new TextEncoder().encode(content)),
  });

  it('verifies the hash and serves later loads from the cache', async () => {
    let fetches = 0;
    const loader = createArtifactLoader({
      cache: createMemoryArtifactCache(),
      fetch: () => {
        fetches += 1;
        return Promise.resolve(new Response(html));
      },
    });
    expect(await loader.load(await ref(html))).toEqual({ ok: true, value: html });
    expect(await loader.load(await ref(html))).toEqual({ ok: true, value: html });
    expect(fetches).toBe(1);
  });

  it('refuses content that does not match the hash', async () => {
    const loader = createArtifactLoader({
      cache: createMemoryArtifactCache(),
      fetch: () => Promise.resolve(new Response('<script>evil()</script>')),
    });
    expect(await loader.load(await ref(html))).toEqual({
      ok: false,
      error: { kind: 'hash-mismatch' },
    });
  });

  it('reports an expired URL or a network failure as unreachable', async () => {
    const expired = createArtifactLoader({
      cache: createMemoryArtifactCache(),
      fetch: () => Promise.resolve(new Response('', { status: 400 })),
    });
    expect(await expired.load(await ref(html))).toEqual({
      ok: false,
      error: { kind: 'unreachable', detail: 'HTTP 400' },
    });
    const offline = createArtifactLoader({
      cache: createMemoryArtifactCache(),
      fetch: () => Promise.reject(new TypeError('Failed to fetch')),
    });
    expect(await offline.load(await ref(html))).toMatchObject({
      ok: false,
      error: { kind: 'unreachable' },
    });
  });
});

describe('createAckTranslator', () => {
  it('maps connection sequences back to the game samples they carried', () => {
    const acks = createAckTranslator();
    acks.sampled(1);
    acks.sent(1);
    acks.sampled(2);
    acks.sampled(3);
    acks.sent(2);
    expect(acks.translate(0)).toBe(0);
    expect(acks.translate(1)).toBe(1);
    expect(acks.translate(2)).toBe(3);
    // An older ack never moves it back.
    expect(acks.translate(1)).toBe(3);
  });
});
