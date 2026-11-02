import { describe, expect, it } from 'vitest';

import {
  classifyPreviewClose,
  createPreviewConnector,
  type PreviewConnectionEvent,
} from './previewConnection';

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

const frontend = {
  url: 'https://cdn/game.html',
  sha256: 'abc',
  expires_at: '2026-11-03T00:00:00Z',
  viewport: { aspect_ratio: '16:9', width: 1920, height: 1080 },
  assets: [],
};

const started = {
  type: 'preview_started',
  preview_uuid: 'pv-1',
  revision: 7,
  participants: ['P1', 'P2'],
  acting_as: 'P1',
  paused: false,
  frontend,
};

const view = (participant: string, revision: number, state: unknown, full = true) => ({
  type: 'player_view',
  participant_id: participant,
  full,
  revision,
  state,
  consumed_through_sample_sequence: 0,
});

function open() {
  const timers = { now: () => 0, setTimeout: () => 0, clearTimeout: () => undefined };
  const result = createPreviewConnector({
    realtimeBaseUrl: 'ws://host',
    credentials: { currentToken: () => 'owner-token' },
    WebSocket: FakeSocket as unknown as typeof WebSocket,
    timers,
    newCommandToken: () => 'tok-1',
  }).connect('pv-1');
  if (!result.ok) throw new Error('expected a connection');
  const events: PreviewConnectionEvent[] = [];
  result.value.subscribe((event) => events.push(event));
  const socket = FakeSocket.last;
  socket.readyState = 1;
  socket.onopen?.();
  return { preview: result.value, socket, events };
}

describe('createPreviewConnector', () => {
  it('opens the preview path with the token subprotocol', () => {
    open();
    expect(FakeSocket.last.url).toBe('ws://host/v1/play/previews/pv-1/connect');
    expect(FakeSocket.last.protocols[0]).toBe('playhoot.v1');
  });

  it('follows the acted-as participant and only passes their views', () => {
    const t = open();
    t.socket.receive(started);
    expect(t.preview.actingAs).toBe('P1');
    t.socket.receive(view('P1', 1, { score: 1 }));
    expect(t.preview.currentView()).toEqual({ participantId: 'P1', state: { score: 1 }, ack: 0 });

    expect(t.preview.actAs('P2')).toBe(true);
    expect(JSON.parse(t.socket.sent.at(-1)!)).toEqual({ type: 'act_as', participant_id: 'P2' });
    // Until the backend confirms the switch the views are still P1's; then P2's FULL view.
    t.socket.receive(view('P1', 2, { score: 2 }, false));
    t.socket.receive({ type: 'acting_as', participant_id: 'P2' });
    expect(t.preview.currentView()).toBeUndefined();
    t.socket.receive(view('P2', 1, { score: 0 }));

    const views = t.events.flatMap((event) => (event.type === 'view' ? [event.participantId] : []));
    expect(views).toEqual(['P1', 'P1', 'P2']);
    expect(t.preview.currentView()).toEqual({ participantId: 'P2', state: { score: 0 }, ack: 0 });
  });

  it('starts sample sequences again at 1 after acting as another participant', () => {
    const t = open();
    t.socket.receive(started);
    t.preview.sample({ move: 1 });
    t.preview.actAs('P2');
    t.preview.sample({ move: 2 });
    const samples = t.socket.sent
      .map((text) => JSON.parse(text))
      .filter((m) => m.type === 'sample');
    expect(samples.map((m) => m.sequence)).toEqual([1, 1]);
  });

  it('sends pause, resume and end, and passes their answers as messages', () => {
    const t = open();
    t.socket.receive(started);
    t.preview.pause();
    t.preview.resume();
    t.preview.end();
    expect(t.socket.sent.map((text) => JSON.parse(text).type)).toEqual(['pause', 'resume', 'end']);
    t.socket.receive({ type: 'paused' });
    t.socket.receive({ type: 'preview_ended', reason: 'ended_by_owner' });
    expect(t.events).toContainEqual({ type: 'message', message: { type: 'paused' } });
    expect(t.events).toContainEqual({
      type: 'message',
      message: { type: 'preview_ended', reason: 'ended_by_owner' },
    });
  });

  it('answers commands by token and closes them with the connection', async () => {
    const t = open();
    t.socket.receive(started);
    const answered = t.preview.command('tap', {});
    t.socket.receive({ type: 'command_result', token: 'tok-1', outcome: 'executed', response: 1 });
    expect(await answered).toEqual({ token: 'tok-1', outcome: 'executed', response: 1 });

    const pending = t.preview.command('tap', {});
    t.socket.onclose?.({ code: 1000, reason: 'session_ended' });
    expect(await pending).toEqual({ token: 'tok-1', outcome: 'connection-closed' });
    expect(t.events.at(-1)).toMatchObject({ type: 'closed', kind: 'ended' });
  });

  it('reports a known message that breaks its contract and ignores unknown types', () => {
    const t = open();
    t.socket.receive({ type: 'acting_as' });
    t.socket.receive({ type: 'something_new' });
    expect(t.events.filter((event) => event.type === 'protocol-error')).toHaveLength(1);
  });
});

describe('classifyPreviewClose', () => {
  it('reads why a preview connection ended', () => {
    expect(classifyPreviewClose(false, 1006, '')).toBe('unreachable');
    expect(classifyPreviewClose(true, 1000, 'session_ended')).toBe('ended');
    expect(classifyPreviewClose(true, 1000, 'replaced')).toBe('replaced');
    expect(classifyPreviewClose(true, 1007, 'malformed message')).toBe('protocol');
    expect(classifyPreviewClose(true, 1012, '')).toBe('retryable');
  });

  it('answers the command the game does not declare and stays open', async () => {
    const { preview, socket, events } = open();
    socket.receive(started);
    const result = preview.command('jump', {});
    socket.receive({
      type: 'error',
      code: 'invalid_game_data',
      detail: 'undeclared command jump',
      token: 'tok-1',
    });
    await expect(result).resolves.toEqual({ token: 'tok-1', outcome: 'invalid' });
    expect(events).toContainEqual({
      type: 'message',
      message: {
        type: 'error',
        code: 'invalid_game_data',
        detail: 'undeclared command jump',
        token: 'tok-1',
      },
    });
    expect(events.some((event) => event.type === 'closed')).toBe(false);
  });
});
