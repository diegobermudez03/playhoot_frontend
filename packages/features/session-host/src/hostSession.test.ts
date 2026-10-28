import { createAppState, type Credential } from '@playhoot/app-core';
import type {
  AdminConnection,
  AdminConnectionEvent,
  AdminConnector,
  SessionConnectionEvent,
} from '@playhoot/communication';
import { describe, expect, it, vi } from 'vitest';

import { canStart, createHostSession } from './hostSession';

const me = 'creator-uuid';

class FakeAdmin implements AdminConnection {
  listeners = new Set<(event: AdminConnectionEvent) => void>();
  closed = false;
  startSession = vi.fn(async () => 'started' as const);
  cancelSession = vi.fn(async () => 'cancelled' as const);
  selectPerspective = vi.fn(async (): Promise<'selected' | 'creator_is_playing'> => 'selected');
  view: { participantId: string; state: unknown } | undefined;
  subscribe(listener: (event: AdminConnectionEvent) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  currentView() {
    return this.view;
  }
  close() {
    this.closed = true;
  }
  emit(event: AdminConnectionEvent) {
    this.listeners.forEach((listener) => listener(event));
  }
  message(message: object) {
    this.emit({ type: 'message', message: message as never });
  }
}

function setup() {
  const credential: Credential = { token: 't', userUUID: me, kind: 'account' };
  const app = createAppState({
    credentials: { load: () => credential, save: () => undefined, clear: () => undefined },
    locale: { store: { load: () => null, save: () => undefined }, devicePreferences: () => [] },
  });
  app.bootstrap();
  const admins: FakeAdmin[] = [];
  const connector: AdminConnector = {
    connect() {
      const admin = new FakeAdmin();
      admins.push(admin);
      return { ok: true, value: admin };
    },
  };
  const scheduled: { run: () => void; delayMs: number }[] = [];
  const host = createHostSession('s-1', 'ABC234', {
    app,
    connector,
    schedule: (run, delayMs) => {
      scheduled.push({ run, delayMs });
      return () => undefined;
    },
  });
  host.start();
  const last = () => admins[admins.length - 1]!;
  last().emit({ type: 'open' });
  return { host, admins, last, scheduled, state: () => host.store.getState() };
}

const lobby = (count: number, limits = { min_players: 2, max_players: 4 }) => ({
  type: 'lobby_update',
  session_uuid: 's-1',
  members: Array.from({ length: count }, (_, i) => ({ user_uuid: `u${i}`, display_name: `P${i}` })),
  ...limits,
});

const started = {
  type: 'session_started',
  session_uuid: 's-1',
  participants: [
    { participant_id: 'P1', user_uuid: 'u0', display_name: 'Ana' },
    { participant_id: 'P2', user_uuid: 'u1', display_name: 'Bea' },
  ],
  frontend: {
    url: 'https://x/game.html',
    sha256: 'h',
    expires_at: 'e',
    viewport: { aspect_ratio: '16:9', width: 1920, height: 1080 },
    assets: [],
  },
};

describe('createHostSession', () => {
  it('shows the lobby with the game limits and starts only within them', () => {
    const t = setup();
    t.last().message(lobby(1));
    const view = t.state().view;
    if (view.phase !== 'lobby') throw new Error('lobby');
    expect(view).toMatchObject({ minPlayers: 2, maxPlayers: 4, members: [{ displayName: 'P0' }] });
    expect(canStart(view)).toBe(false);

    t.last().message(lobby(2));
    const enough = t.state().view;
    if (enough.phase !== 'lobby') throw new Error('lobby');
    expect(canStart(enough)).toBe(true);
    expect(t.state().joinCode).toBe('ABC234');
  });

  it('starts, then watches the first participant', async () => {
    const t = setup();
    t.last().message(lobby(2));
    await t.host.startGame();
    expect(t.last().startSession).toHaveBeenCalledTimes(1);

    t.last().message(started);
    expect(t.state().view).toMatchObject({ phase: 'started', watching: 'P1' });
    expect(t.last().selectPerspective).toHaveBeenCalledWith('P1');

    await t.host.watch('P2');
    expect(t.state().view).toMatchObject({ watching: 'P2' });
  });

  it('keeps the lobby with the reason when the backend refuses to start', async () => {
    const t = setup();
    t.last().message(lobby(2));
    t.last().startSession.mockResolvedValueOnce('invalid_player_count' as never);
    await t.host.startGame();
    expect(t.state().view).toMatchObject({
      phase: 'lobby',
      starting: false,
      startError: 'invalid_player_count',
    });
  });

  it('cancels, and ends with how the Session ended', async () => {
    const t = setup();
    t.last().message(lobby(1));
    await t.host.cancel();
    expect(t.last().cancelSession).toHaveBeenCalled();
    t.last().message({ type: 'lobby_closed', status: 'CANCELLED', end_cause: 'HOST_CANCELLED' });
    expect(t.state().view).toEqual({
      phase: 'closed',
      outcome: { kind: 'ended', status: 'CANCELLED', endCause: 'HOST_CANCELLED' },
    });
  });

  it('does not watch while the creator plays here, and stops watching when the backend refuses', async () => {
    const t = setup();
    t.last().message(lobby(2));
    t.host.playToo();
    expect(t.state().playing).toBe(true);
    t.last().message(started);
    expect(t.last().selectPerspective).not.toHaveBeenCalled();

    const other = setup();
    other.last().selectPerspective.mockResolvedValueOnce('creator_is_playing');
    other.last().message(started);
    await Promise.resolve();
    await Promise.resolve();
    expect(other.state().watchBlocked).toBe(true);
    expect(other.state().view).toMatchObject({ watching: null });
  });

  it('reconnects after a lost connection and keeps watching the same participant', async () => {
    const t = setup();
    t.last().message(started);
    await t.host.watch('P2');
    t.last().emit({ type: 'closed', kind: 'retryable', code: 1006, reason: '' });
    expect(t.state().view).toMatchObject({ phase: 'started', connection: 'reconnecting' });

    t.scheduled[0]!.run();
    t.last().emit({ type: 'open' });
    t.last().message(started);
    expect(t.state().view).toMatchObject({ connection: 'connected', watching: 'P2' });
    expect(t.last().selectPerspective).toHaveBeenCalledWith('P2');
  });

  it('ends as unreachable when the first handshake fails', () => {
    const t = setup();
    t.admins.splice(0);
    t.host.retry();
    t.last().emit({ type: 'closed', kind: 'unreachable', code: 1006, reason: '' });
    expect(t.state().view).toEqual({ phase: 'closed', outcome: { kind: 'unreachable' } });
  });

  it('gives the GameHost the watched views read only', () => {
    const t = setup();
    t.last().message(started); // watches P1
    const events: SessionConnectionEvent[] = [];
    t.host.live.subscribe((event) => events.push(event));
    const update = {
      kind: 'state' as const,
      full: true,
      state: { x: 1 },
      revision: 1,
      ack: 0,
      events: [],
      errors: [],
    };
    t.last().emit({ type: 'view', participantId: 'P1', update });
    expect(events).toEqual([{ type: 'open' }, { type: 'view', update }]);

    t.last().view = { participantId: 'P1', state: { x: 1 } };
    expect(t.host.live.currentView()).toEqual({ state: { x: 1 }, ack: 0 });
    t.host.live.sample({ move: 1 });
    expect(t.host.live.reportGameFault()).toBe(false);
  });

  it('gives the game only the watched participant state, never the previous one', async () => {
    const t = setup();
    t.last().message(started);
    await Promise.resolve();
    const events: SessionConnectionEvent[] = [];
    t.host.live.subscribe((event) => events.push(event));
    t.last().view = { participantId: 'P1', state: { who: 'P1' } };

    // Switching to P2: until P2's FULL view arrives, the game gets no state, and P1's views are dropped.
    let answer: (outcome: 'selected') => void = () => undefined;
    t.last().selectPerspective.mockImplementationOnce(() => new Promise((r) => (answer = r)));
    const switching = t.host.watch('P2');
    expect(t.host.live.currentView()).toBeUndefined();
    const p1Update = {
      kind: 'state' as const,
      full: false,
      state: { who: 'P1' },
      revision: 2,
      ack: 0,
      events: [],
      errors: [],
    };
    t.last().emit({ type: 'view', participantId: 'P1', update: p1Update });
    expect(events).toEqual([]);
    answer('selected');
    await switching;
    t.last().view = { participantId: 'P2', state: { who: 'P2' } };
    expect(t.host.live.currentView()).toEqual({ state: { who: 'P2' }, ack: 0 });
  });

  it('goes back to the previous participant when a selection is not accepted', async () => {
    const t = setup();
    t.last().message(started);
    await Promise.resolve();
    expect(t.state().view).toMatchObject({ watching: 'P1' });
    t.last().selectPerspective.mockResolvedValueOnce('unknown_participant' as never);
    await t.host.watch('P9');
    expect(t.state().view).toMatchObject({ watching: 'P1' });
  });
});
