import { describe, expect, it } from 'vitest';

import {
  classifyClose,
  createSessionConnector,
  decodeServerMessage,
  type SessionConnectionEvent,
} from './sessionConnection';

class FakeSocket {
  static last: FakeSocket;
  readonly OPEN = 1;
  readyState = 0;
  sent: string[] = [];
  closedWith: number | undefined;
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
  close(code: number) {
    this.closedWith = code;
  }
}

function connect(token: string | null = 'test-user-2') {
  const connector = createSessionConnector({
    realtimeBaseUrl: 'ws://host',
    credentials: { currentToken: () => token },
    WebSocket: FakeSocket as unknown as typeof WebSocket,
  });
  return connector.connect({ kind: 'joinCode', joinCode: 'ABC234' });
}

describe('createSessionConnector', () => {
  it('opens the join path with the realtime and token subprotocols', () => {
    expect(connect().ok).toBe(true);
    expect(FakeSocket.last.url).toBe('ws://host/v1/play/join/ABC234');
    // base64url("test-user-2") without padding
    expect(FakeSocket.last.protocols).toEqual([
      'playhoot.v1',
      'base64url.bearer.authorization.playhoot.dGVzdC11c2VyLTI',
    ]);
  });

  it('refuses to connect without a credential', () => {
    expect(connect(null)).toEqual({ ok: false, error: { kind: 'no-credential' } });
  });

  it('emits open, decoded messages and a classified close; sends leave when open', () => {
    const result = connect();
    if (!result.ok) throw new Error('expected a connection');
    const events: SessionConnectionEvent[] = [];
    result.value.subscribe((e) => events.push(e));
    const socket = FakeSocket.last;

    socket.readyState = 1;
    socket.onopen?.();
    socket.onmessage?.({ data: '{"type":"lobby_update","session_uuid":"s","members":[]}' });
    result.value.leave();
    socket.onclose?.({ code: 1000, reason: 'left' });

    expect(socket.sent).toEqual(['{"type":"leave"}']);
    expect(events).toEqual([
      { type: 'open' },
      { type: 'message', message: { type: 'lobby_update', session_uuid: 's', members: [] } },
      { type: 'closed', kind: 'left', code: 1000, reason: 'left' },
    ]);
  });

  it('emits nothing after the client closes it', () => {
    const result = connect();
    if (!result.ok) throw new Error('expected a connection');
    const events: SessionConnectionEvent[] = [];
    result.value.subscribe((e) => events.push(e));
    result.value.close();
    FakeSocket.last.onclose?.({ code: 1000, reason: '' });
    expect(FakeSocket.last.closedWith).toBe(1000);
    expect(events).toEqual([]);
  });
});

describe('decodeServerMessage', () => {
  it('ignores message types it does not know (the server may add types)', () => {
    expect(decodeServerMessage('{"type":"future_thing","x":1}')).toBeNull();
  });

  it('decodes display names (empty when missing) and roster updates', () => {
    expect(
      decodeServerMessage(
        '{"type":"lobby_update","session_uuid":"s","members":[{"user_uuid":"u"}]}',
      ),
    ).toEqual({
      type: 'message',
      message: {
        type: 'lobby_update',
        session_uuid: 's',
        members: [{ user_uuid: 'u', display_name: '' }],
      },
    });
    expect(
      decodeServerMessage(
        '{"type":"roster_update","members":[{"participant_id":"P1","user_uuid":"u","display_name":"Ana","status":"reconnecting"}]}',
      ),
    ).toEqual({
      type: 'message',
      message: {
        type: 'roster_update',
        members: [
          { participant_id: 'P1', user_uuid: 'u', display_name: 'Ana', status: 'reconnecting' },
        ],
      },
    });
  });

  it('reports broken frames and broken modeled messages', () => {
    expect(decodeServerMessage('nope')).toEqual({ type: 'protocol-error', detail: 'invalid JSON' });
    expect(decodeServerMessage('{"x":1}')).toEqual({
      type: 'protocol-error',
      detail: 'message without type',
    });
    expect(decodeServerMessage('{"type":"lobby_update"}')).toEqual({
      type: 'protocol-error',
      detail: 'invalid lobby_update message',
    });
  });
});

describe('classifyClose', () => {
  it.each([
    [false, 1006, '', 'unreachable'],
    [true, 1000, 'session_ended', 'session-ended'],
    [true, 1000, 'left', 'left'],
    [true, 1000, 'replaced', 'replaced'],
    [true, 1000, 'disconnected', 'disconnected'],
    [true, 1001, '', 'retryable'],
    [true, 1006, '', 'retryable'],
    [true, 1011, '', 'retryable'],
    [true, 1012, 'owner_changed', 'retryable'],
    [true, 1007, '', 'protocol'],
    [true, 1008, 'rate limited', 'protocol'],
  ] as const)('opened=%s %i %s -> %s', (opened, code, reason, kind) => {
    expect(classifyClose(opened, code, reason)).toBe(kind);
  });
});
