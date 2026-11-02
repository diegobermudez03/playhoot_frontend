import type {
  PreviewConnection,
  PreviewConnectionEvent,
  PreviewConnector,
  SessionConnectionEvent,
} from '@playhoot/communication';
import { describe, expect, it, vi } from 'vitest';

import { createGamePreview, type GamePreviewDeps } from './preview';

// A preview connection driven by the test: it records what the feature sends and replays what the
// backend would answer.
function fakeConnection() {
  const listeners = new Set<(event: PreviewConnectionEvent) => void>();
  let actingAs: string | null = null;
  const sent: unknown[] = [];
  const connection: PreviewConnection = {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    get actingAs() {
      return actingAs;
    },
    actAs(participantId) {
      sent.push({ actAs: participantId });
      return true;
    },
    sample(inputs) {
      sent.push({ sample: inputs });
    },
    command(name) {
      sent.push({ command: name });
      return Promise.resolve({ token: 't', outcome: 'executed' });
    },
    currentView: () =>
      actingAs ? { participantId: actingAs, state: { me: actingAs }, ack: 0 } : undefined,
    resync: () => undefined,
    pause: () => (sent.push('pause'), true),
    resume: () => (sent.push('resume'), true),
    end: () => (sent.push('end'), true),
    close: vi.fn(),
  };
  const emit = (event: PreviewConnectionEvent) => {
    if (event.type === 'message' && event.message.type === 'preview_started') {
      actingAs = event.message.acting_as;
    }
    if (event.type === 'message' && event.message.type === 'acting_as') {
      actingAs = event.message.participant_id;
    }
    listeners.forEach((listener) => listener(event));
  };
  return { connection, emit, sent };
}

const startedMessage = {
  type: 'preview_started' as const,
  preview_uuid: 'pv-1',
  revision: 7,
  participants: ['P1', 'P2'],
  acting_as: 'P1',
  paused: false,
  frontend: {
    url: 'https://cdn/game.html',
    sha256: 'abc',
    expires_at: '2026-11-03T00:00:00Z',
    viewport: { aspect_ratio: '16:9', width: 1920, height: 1080 },
    assets: [],
  },
};

function setUp(createPreview: GamePreviewDeps['games']['createPreview']) {
  const live = fakeConnection();
  const previews: PreviewConnector = { connect: () => ({ ok: true, value: live.connection }) };
  const preview = createGamePreview('g-1', { games: { createPreview }, previews });
  return { preview, live };
}

const created = () =>
  Promise.resolve({
    ok: true as const,
    value: { previewUUID: 'pv-1', revision: 7, participants: ['P1', 'P2'] },
  });

describe('createGamePreview', () => {
  it('opens a preview and runs once the backend confirms the start', async () => {
    const createPreview = vi.fn(created);
    const { preview, live } = setUp(createPreview);
    preview.setPlayers(2);
    await preview.start();
    expect(createPreview).toHaveBeenCalledWith('g-1', 2);

    live.emit({ type: 'message', message: startedMessage });
    const view = preview.store.getState().view;
    expect(view.phase).toBe('running');
    if (view.phase !== 'running') return;
    expect(view.preview).toMatchObject({ revision: 7, actingAs: 'P1', paused: false });
    expect(view.preview.frontend?.viewport).toEqual({
      aspectRatio: '16:9',
      width: 1920,
      height: 1080,
    });
  });

  it('gives each participant a port that only acts while they are the one played', async () => {
    const { preview, live } = setUp(created);
    await preview.start();
    live.emit({ type: 'message', message: startedMessage });
    const p1 = preview.port('P1');
    const p1Events: SessionConnectionEvent[] = [];
    p1.subscribe((event) => p1Events.push(event));

    p1.sample({ move: 1 });
    expect(p1.currentView()).toEqual({ state: { me: 'P1' }, ack: 0 });

    preview.actAs('P2');
    live.emit({ type: 'message', message: { type: 'acting_as', participant_id: 'P2' } });
    // The game still shown for P1 while it is replaced: its inputs and commands go nowhere.
    p1.sample({ move: 2 });
    expect(await p1.command('tap')).toMatchObject({ outcome: 'connection-closed' });
    expect(p1.currentView()).toBeUndefined();
    live.emit({
      type: 'view',
      participantId: 'P2',
      update: { kind: 'state', full: true, state: {}, revision: 1, ack: 0, events: [], errors: [] },
    });
    expect(p1Events.filter((event) => event.type === 'view')).toHaveLength(0);

    const p2 = preview.port('P2');
    p2.sample({ move: 3 });
    expect(live.sent).toEqual([{ sample: { move: 1 } }, { actAs: 'P2' }, { sample: { move: 3 } }]);
  });

  it('tracks pause, resume and the end with its reason', async () => {
    const { preview, live } = setUp(created);
    await preview.start();
    live.emit({ type: 'message', message: startedMessage });
    preview.pause();
    live.emit({ type: 'message', message: { type: 'paused' } });
    const paused = preview.store.getState().view;
    expect(paused.phase === 'running' && paused.preview.paused).toBe(true);

    live.emit({ type: 'message', message: { type: 'preview_ended', reason: 'idle' } });
    live.emit({ type: 'closed', kind: 'ended', code: 1000, reason: 'session_ended' });
    expect(preview.store.getState().view).toMatchObject({
      phase: 'ended',
      end: { kind: 'ended', reason: 'idle' },
    });
    expect(live.sent).toContain('pause');
  });

  it('keeps the accepted range when the backend refuses the number of players', async () => {
    const { preview } = setUp(() =>
      Promise.resolve({ ok: false as const, error: { kind: 'invalid-players', min: 1, max: 8 } }),
    );
    preview.setPlayers(9);
    await preview.start();
    expect(preview.store.getState()).toMatchObject({
      view: { phase: 'idle' },
      range: { min: 1, max: 8 },
      startFailure: { kind: 'invalid-players' },
    });
  });

  it('tells a build that is not ready apart from other failures', async () => {
    const { preview } = setUp(() =>
      Promise.resolve({
        ok: false as const,
        error: { kind: 'build-not-ready', buildStatus: 'FAILED' },
      }),
    );
    await preview.start();
    expect(preview.store.getState().startFailure).toEqual({
      kind: 'build-not-ready',
      buildStatus: 'FAILED',
    });
  });

  it('shows a start the game failed in its script', async () => {
    const { preview } = setUp(() =>
      Promise.resolve({ ok: false as const, error: { kind: 'script-failure' } }),
    );
    await preview.start();
    expect(preview.store.getState().startFailure).toEqual({ kind: 'script-failure' });
  });

  it('keeps running and shows what the backend reported, until dismissed', async () => {
    const { preview, live } = setUp(created);
    await preview.start();
    live.emit({ type: 'message', message: startedMessage });
    live.emit({
      type: 'message',
      message: { type: 'error', code: 'invalid_game_data', detail: 'undeclared command jump' },
    });
    expect(preview.store.getState().view.phase).toBe('running');
    expect(preview.store.getState().notice).toEqual({
      kind: 'invalid-game-data',
      detail: 'undeclared command jump',
    });
    live.emit({ type: 'message', message: { type: 'error', code: 'unknown_participant' } });
    expect(preview.store.getState().notice).toEqual({ kind: 'unknown-participant', detail: null });
    preview.dismissNotice();
    expect(preview.store.getState().notice).toBeNull();
  });

  it('closes the connection when disposed', async () => {
    const { preview, live } = setUp(created);
    await preview.start();
    preview.dispose();
    expect(live.connection.close).toHaveBeenCalled();
  });
});
