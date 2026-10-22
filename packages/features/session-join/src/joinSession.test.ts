import { createAppState, type Credential, type CredentialStore } from '@playhoot/app-core';
import type {
  IdentityClient,
  SessionConnection,
  SessionConnectionEvent,
  SessionConnector,
  SessionTarget,
} from '@playhoot/communication';
import { describe, expect, it, vi } from 'vitest';

import { createJoinSession } from './joinSession';

// The game frontend of every session_started below, as the backend sends it.
const frontend = {
  url: 'u',
  sha256: 'h',
  expires_at: 'x',
  viewport: { aspect_ratio: '16:9', width: 1920, height: 1080 },
};

const me = 'user-me';

function memoryStore(initial: Credential | null): CredentialStore {
  let value = initial;
  return {
    load: () => value,
    save: (c) => void (value = c),
    clear: () => void (value = null),
  };
}

class FakeConnection implements SessionConnection {
  listeners = new Set<(event: SessionConnectionEvent) => void>();
  left = false;
  closed = false;
  subscribe(listener: (event: SessionConnectionEvent) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  leave() {
    this.left = true;
  }
  samples: Record<string, unknown>[] = [];
  view: { state: unknown; ack: number } | undefined = undefined;
  sample(inputs: Record<string, unknown>) {
    this.samples.push(inputs);
  }
  currentView() {
    return this.view;
  }
  resync() {}
  faults: Array<{ kind: string; detail: Record<string, unknown> }> = [];
  reportGameFault(kind: string, detail: Record<string, unknown>) {
    this.faults.push({ kind, detail });
    return true;
  }
  command(name: string) {
    return Promise.resolve({ token: name, outcome: 'connection-closed' as const });
  }
  close() {
    this.closed = true;
  }
  emit(event: SessionConnectionEvent) {
    this.listeners.forEach((l) => l(event));
  }
  message(message: object) {
    this.emit({ type: 'message', message: message as never });
  }
}

function setup(options: { signedIn?: boolean; target?: SessionTarget } = {}) {
  const app = createAppState({
    credentials: memoryStore(
      options.signedIn === false ? null : { token: 't', userUUID: me, kind: 'guest' },
    ),
    locale: { store: { load: () => null, save: () => undefined }, devicePreferences: () => [] },
  });
  app.bootstrap();
  const connections: { target: SessionTarget; connection: FakeConnection }[] = [];
  const connector: SessionConnector = {
    connect(target) {
      if (!app.credentials.currentToken()) return { ok: false, error: { kind: 'no-credential' } };
      const connection = new FakeConnection();
      connections.push({ target, connection });
      return { ok: true, value: connection };
    },
  };
  const identity: IdentityClient = {
    createGuest: vi.fn(async () => ({ ok: true as const, value: { userUUID: me, token: 'g' } })),
  };
  const scheduled: { run: () => void; delayMs: number }[] = [];
  const join = createJoinSession(options.target ?? { kind: 'joinCode', joinCode: 'ABC234' }, {
    app,
    identity,
    connector,
    newIdempotencyKey: () => 'key-1',
    schedule: (run, delayMs) => {
      scheduled.push({ run, delayMs });
      return () => undefined;
    },
  });
  const last = () => connections[connections.length - 1]!.connection;
  return {
    app,
    join,
    connections,
    identity,
    scheduled,
    last,
    view: () => join.store.getState().view,
  };
}

const started = {
  type: 'session_started',
  session_uuid: 's-1',
  participant_id: 'P1',
  participants: [{ participant_id: 'P1', user_uuid: me }],
  frontend,
};

describe('createJoinSession', () => {
  it('asks for a name without an identity, creates a guest, then connects by code', async () => {
    const t = setup({ signedIn: false });
    t.join.start();
    expect(t.view()).toEqual({ phase: 'identity', submitting: false, error: null });

    await t.join.submitDisplayName('  Ana  ');

    expect(t.identity.createGuest).toHaveBeenCalledWith('Ana', 'key-1');
    expect(t.app.store.getState().auth).toMatchObject({ status: 'guest', displayName: 'Ana' });
    expect(t.connections[0]!.target).toEqual({ kind: 'joinCode', joinCode: 'ABC234' });
    expect(t.view()).toEqual({ phase: 'connecting', reconnectAttempt: 0 });
  });

  it('rejects an empty name locally', async () => {
    const t = setup({ signedIn: false });
    t.join.start();
    await t.join.submitDisplayName('   ');
    expect(t.view()).toMatchObject({
      phase: 'identity',
      error: { kind: 'invalid-name', reason: 'empty', maxLength: 64 },
    });
    expect(t.identity.createGuest).not.toHaveBeenCalled();
  });

  it('enters the lobby, learns the Session UUID and marks the player', () => {
    const t = setup();
    t.join.start();
    t.last().emit({ type: 'open' });
    t.last().message({
      type: 'lobby_update',
      session_uuid: 's-1',
      members: [
        { user_uuid: 'other', display_name: 'Bruno' },
        { user_uuid: me, display_name: 'Ana' },
      ],
    });

    expect(t.join.store.getState().sessionUUID).toBe('s-1');
    expect(t.view()).toEqual({
      phase: 'lobby',
      members: [
        { userUUID: 'other', displayName: 'Bruno', isYou: false },
        { userUUID: me, displayName: 'Ana', isYou: true },
      ],
    });
  });

  it('moves to started with the roster when the Session starts', () => {
    const t = setup();
    t.join.start();
    t.last().message({
      type: 'session_started',
      session_uuid: 's-1',
      participant_id: 'P2',
      participants: [
        { participant_id: 'P1', user_uuid: 'other', display_name: 'Bruno' },
        { participant_id: 'P2', user_uuid: me, display_name: 'Ana' },
      ],
      frontend,
    });
    const view = t.view();
    expect(view.phase === 'started' && view.session.frontend).toEqual({
      url: 'u',
      sha256: 'h',
      expiresAt: 'x',
      viewport: { aspectRatio: '16:9', width: 1920, height: 1080 },
    });
    expect(view.phase === 'started' && view.session.participants[1]).toEqual({
      participantId: 'P2',
      userUUID: me,
      displayName: 'Ana',
      isYou: true,
      status: 'active',
    });
  });

  it('applies roster updates to the participants during the game', () => {
    const t = setup();
    t.join.start();
    t.last().message({
      type: 'session_started',
      session_uuid: 's-1',
      participant_id: 'P1',
      participants: [
        { participant_id: 'P1', user_uuid: me, display_name: 'Ana' },
        { participant_id: 'P2', user_uuid: 'other', display_name: 'Bruno' },
      ],
      frontend,
    });
    t.last().message({
      type: 'roster_update',
      members: [
        { participant_id: 'P1', user_uuid: me, display_name: 'Ana', status: 'active' },
        { participant_id: 'P2', user_uuid: 'other', display_name: 'Bruno', status: 'left' },
      ],
    });
    const view = t.view();
    expect(view.phase === 'started' && view.session.participants.map((p) => p.status)).toEqual([
      'active',
      'left',
    ]);

    t.last().message({
      type: 'roster_update',
      members: [
        { participant_id: 'P1', user_uuid: me, display_name: 'Ana', status: 'active' },
        { participant_id: 'P2', user_uuid: 'other', display_name: 'Bruno', status: 'away' },
      ],
    });
    const later = t.view();
    expect(later.phase === 'started' && later.session.participants[1]?.status).toBe('unknown');
  });

  it('keeps the game when the connection drops mid-game, and the live link follows the new one', () => {
    const t = setup();
    t.join.start();
    const events: string[] = [];
    t.join.live.subscribe((event) => events.push(event.type));
    t.last().emit({ type: 'open' });
    t.last().message(started);
    t.join.live.sample({ move: [1, 0] });
    expect(t.last().samples).toEqual([{ move: [1, 0] }]);

    t.last().emit({ type: 'closed', kind: 'retryable', code: 1006, reason: '' });
    expect(t.view()).toMatchObject({ phase: 'started', connection: 'reconnecting' });
    t.scheduled[0]!.run();
    expect(t.connections[1]!.target).toEqual({ kind: 'session', sessionUUID: 's-1' });
    expect(t.view()).toMatchObject({ phase: 'started', connection: 'reconnecting' });

    t.last().view = { state: { x: 1 }, ack: 0 };
    t.last().emit({ type: 'open' });
    t.last().message(started);
    expect(t.view()).toMatchObject({ phase: 'started', connection: 'connected' });
    expect(t.join.live.currentView()).toEqual({ state: { x: 1 }, ack: 0 });
    t.join.live.sample({ move: [0, 1] });
    expect(t.last().samples).toEqual([{ move: [0, 1] }]);
    // Lobby and lifecycle messages are the join's business, not the game's.
    expect(events).toEqual(['open', 'open']);
  });

  it('reconnects mid-game when the Session moves to another instance (1012)', () => {
    const t = setup();
    t.join.start();
    t.last().emit({ type: 'open' });
    t.last().message(started);
    t.last().emit({ type: 'closed', kind: 'retryable', code: 1012, reason: 'owner_changed' });
    expect(t.view()).toMatchObject({ phase: 'started', connection: 'reconnecting' });
    t.scheduled[0]!.run();
    expect(t.connections[1]!.target).toEqual({ kind: 'session', sessionUUID: 's-1' });
    t.last().emit({ type: 'open' });
    t.last().message(started);
    expect(t.view()).toMatchObject({ phase: 'started', connection: 'connected' });
  });

  it('ends for this player when the game refuses them back after the grace', () => {
    for (const reason of ['participant_disconnected', 'rejoin_rejected'] as const) {
      const t = setup();
      t.join.start();
      t.last().emit({ type: 'open' });
      t.last().message(started);
      t.last().emit({ type: 'closed', kind: 'retryable', code: 1006, reason: '' });
      t.scheduled[0]!.run();
      t.last().message({ type: 'rejected', reason });
      t.last().emit({ type: 'closed', kind: 'protocol', code: 1008, reason: 'admission rejected' });
      expect(t.view()).toEqual({ phase: 'closed', outcome: { kind: 'rejected', reason } });
      expect(t.scheduled).toHaveLength(1);
    }
  });

  it('reports game faults on the current connection, and not without one', () => {
    const t = setup();
    expect(t.join.live.reportGameFault('ready_timeout', {})).toBe(false);
    t.join.start();
    expect(t.join.live.reportGameFault('ready_timeout', { refused: {} })).toBe(true);
    expect(t.last().faults).toEqual([{ kind: 'ready_timeout', detail: { refused: {} } }]);
  });

  it('answers commands on the live link as connection-closed while there is no connection', async () => {
    const t = setup();
    expect(await t.join.live.command('teleport', null, { token: 'k' })).toEqual({
      token: 'k',
      outcome: 'connection-closed',
    });
  });

  it('reports a rejection with its reason, and unknown reasons as unknown', () => {
    const t = setup();
    t.join.start();
    t.last().message({ type: 'rejected', reason: 'lobby_full' });
    t.last().emit({ type: 'closed', kind: 'protocol', code: 1008, reason: 'admission rejected' });
    expect(t.view()).toEqual({
      phase: 'closed',
      outcome: { kind: 'rejected', reason: 'lobby_full' },
    });

    const u = setup();
    u.join.start();
    u.last().message({ type: 'rejected', reason: 'brand_new' });
    expect(u.view()).toEqual({ phase: 'closed', outcome: { kind: 'rejected', reason: 'unknown' } });
  });

  it('treats a first handshake failure as unreachable, without retrying', () => {
    const t = setup();
    t.join.start();
    t.last().emit({ type: 'closed', kind: 'unreachable', code: 1006, reason: '' });
    expect(t.view()).toEqual({ phase: 'closed', outcome: { kind: 'unreachable' } });
    expect(t.scheduled).toHaveLength(0);
  });

  it('reconnects by Session UUID after a lost connection, then gives up', () => {
    const t = setup();
    t.join.start();
    t.last().emit({ type: 'open' });
    t.last().message({ type: 'lobby_update', session_uuid: 's-1', members: [{ user_uuid: me }] });
    t.last().emit({ type: 'closed', kind: 'retryable', code: 1006, reason: '' });

    expect(t.view()).toEqual({ phase: 'connecting', reconnectAttempt: 1 });
    expect(t.scheduled.map((s) => s.delayMs)).toEqual([1000]);

    t.scheduled[0]!.run();
    expect(t.connections[1]!.target).toEqual({ kind: 'session', sessionUUID: 's-1' });
    t.last().emit({ type: 'closed', kind: 'unreachable', code: 1006, reason: '' });
    t.scheduled[1]!.run();
    t.last().emit({ type: 'closed', kind: 'unreachable', code: 1006, reason: '' });
    t.scheduled[2]!.run();
    t.last().emit({ type: 'closed', kind: 'unreachable', code: 1006, reason: '' });

    expect(t.scheduled.map((s) => s.delayMs)).toEqual([1000, 2000, 4000]);
    expect(t.view()).toEqual({ phase: 'closed', outcome: { kind: 'connection-lost' } });
  });

  it('keeps the terminal message as the outcome when the connection then closes', () => {
    const t = setup();
    t.join.start();
    t.last().emit({ type: 'open' });
    t.last().message({ type: 'lobby_closed', status: 'EXPIRED', end_cause: 'LOBBY_EXPIRED' });
    t.last().emit({ type: 'closed', kind: 'session-ended', code: 1000, reason: 'session_ended' });
    expect(t.view()).toEqual({
      phase: 'closed',
      outcome: { kind: 'ended', status: 'EXPIRED', endCause: 'LOBBY_EXPIRED', beforeStart: true },
    });
  });

  it('leaves through the connection and ends as left', () => {
    const t = setup();
    t.join.start();
    t.last().emit({ type: 'open' });
    t.join.leave();
    expect(t.last().left).toBe(true);
    expect(t.view()).toEqual({ phase: 'leaving' });
    t.last().emit({ type: 'closed', kind: 'left', code: 1000, reason: 'left' });
    expect(t.view()).toEqual({ phase: 'closed', outcome: { kind: 'left' } });
  });

  it('is replaced, not reconnected, when the same player connects elsewhere', () => {
    const t = setup();
    t.join.start();
    t.last().emit({ type: 'open' });
    t.last().emit({ type: 'closed', kind: 'replaced', code: 1000, reason: 'replaced' });
    expect(t.view()).toEqual({ phase: 'closed', outcome: { kind: 'replaced' } });
    expect(t.scheduled).toHaveLength(0);
  });

  it('closes the connection on dispose and ignores later events', () => {
    const t = setup();
    t.join.start();
    const connection = t.last();
    t.join.dispose();
    expect(connection.closed).toBe(true);
    connection.message({ type: 'lobby_update', session_uuid: 's-1', members: [] });
    expect(t.view()).toEqual({ phase: 'connecting', reconnectAttempt: 0 });
  });

  it('starts from the Session UUID when the URL carries it', () => {
    const t = setup({ target: { kind: 'session', sessionUUID: 's-9' } });
    expect(t.join.store.getState().sessionUUID).toBe('s-9');
    t.join.start();
    expect(t.connections[0]!.target).toEqual({ kind: 'session', sessionUUID: 's-9' });
  });
});
