import { describe, expect, it } from 'vitest';

import { createAdminConnector, type AdminConnectionEvent } from './adminConnection';

class FakeSocket {
  static last: FakeSocket;
  readonly OPEN = 1;
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  constructor(
    public url: string,
    public protocols: string[],
  ) {
    FakeSocket.last = this;
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {}
  receive(message: object) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}

function open() {
  const result = createAdminConnector({
    realtimeBaseUrl: 'ws://host',
    credentials: { currentToken: () => 'test-user-1' },
    WebSocket: FakeSocket as unknown as typeof WebSocket,
  }).connect('s-1');
  if (!result.ok) throw new Error('expected a connection');
  const events: AdminConnectionEvent[] = [];
  result.value.subscribe((event) => events.push(event));
  const socket = FakeSocket.last;
  socket.readyState = 1;
  socket.onopen?.();
  return { admin: result.value, socket, events };
}

describe('createAdminConnector', () => {
  it('opens the admin path of the Session with the token subprotocol', () => {
    open();
    expect(FakeSocket.last.url).toBe('ws://host/v1/play/join/sessions/s-1/admin');
    expect(FakeSocket.last.protocols[0]).toBe('playhoot.v1');
  });

  it('passes lobby updates with the player limits', () => {
    const t = open();
    t.socket.receive({
      type: 'lobby_update',
      session_uuid: 's-1',
      members: [{ user_uuid: 'u', display_name: 'Ana' }],
      min_players: 2,
      max_players: 8,
    });
    expect(t.events).toContainEqual({
      type: 'message',
      message: {
        type: 'lobby_update',
        session_uuid: 's-1',
        members: [{ user_uuid: 'u', display_name: 'Ana' }],
        min_players: 2,
        max_players: 8,
      },
    });
  });

  it('answers each request with its own result, in order, and unknown outcomes as unknown', async () => {
    const t = open();
    const start = t.admin.startSession();
    const cancel = t.admin.cancelSession();
    expect(t.socket.sent).toEqual(['{"type":"start_session"}', '{"type":"cancel_session"}']);

    t.socket.receive({ type: 'cancel_session_result', outcome: 'cancelled' });
    t.socket.receive({ type: 'start_session_result', outcome: 'something_new' });

    expect(await cancel).toBe('cancelled');
    expect(await start).toBe('unknown');
  });

  it('ends pending requests as connection-closed when the connection closes', async () => {
    const t = open();
    const start = t.admin.startSession();
    t.socket.onclose?.({ code: 1000, reason: 'session_ended' });
    expect(await start).toBe('connection-closed');
    expect(t.events.at(-1)).toEqual({
      type: 'closed',
      kind: 'session-ended',
      code: 1000,
      reason: 'session_ended',
    });
  });

  it('reconciles the watched participant views, starting over for another one', async () => {
    const t = open();
    const selected = t.admin.selectPerspective('P1');
    expect(t.socket.sent).toEqual(['{"type":"select_perspective","participant_id":"P1"}']);
    t.socket.receive({ type: 'select_perspective_result', outcome: 'selected' });
    expect(await selected).toBe('selected');

    t.socket.receive({
      type: 'player_view',
      participant_id: 'P1',
      full: true,
      revision: 1,
      state: { x: 1, y: 1 },
    });
    t.socket.receive({
      type: 'player_view',
      participant_id: 'P1',
      full: false,
      revision: 2,
      state: { x: 2 },
    });
    expect(t.admin.currentView()).toEqual({ participantId: 'P1', state: { x: 2, y: 1 } });

    t.socket.receive({
      type: 'player_view',
      participant_id: 'P2',
      full: true,
      revision: 3,
      state: { x: 9 },
    });
    expect(t.admin.currentView()).toEqual({ participantId: 'P2', state: { x: 9 } });
  });

  it('asks for a FULL view once after a gap', () => {
    const t = open();
    t.socket.receive({
      type: 'player_view',
      participant_id: 'P1',
      full: true,
      revision: 1,
      state: {},
    });
    t.socket.receive({
      type: 'player_view',
      participant_id: 'P1',
      full: false,
      revision: 3,
      state: {},
    });
    t.socket.receive({
      type: 'player_view',
      participant_id: 'P1',
      full: false,
      revision: 4,
      state: {},
    });
    expect(t.socket.sent).toEqual(['{"type":"resync"}']);
    expect(t.events).toContainEqual({ type: 'resync-requested' });
    expect(t.admin.currentView()).toBeUndefined();
  });
});
