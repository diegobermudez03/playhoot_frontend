import type { SessionConnectionEvent } from '@playhoot/communication';
import type {
  ArtifactLoader,
  GameContainer,
  GameSessionPort,
  GameViewport,
} from '@playhoot/game-host';
import { describe, expect, it } from 'vitest';

import { createSessionPlay, type SessionPlayTelemetry } from './sessionPlay';

const flush = async () => {
  for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};

function fakeContainer() {
  const opened: Array<{
    toHost(raw: unknown): void;
    viewport: GameViewport;
    sent: unknown[];
    disposed: boolean;
  }> = [];
  const container: GameContainer = {
    open(_html, viewport, handlers) {
      const entry = {
        toHost: handlers.onMessage,
        viewport,
        sent: [] as unknown[],
        disposed: false,
      };
      opened.push(entry);
      return {
        send: (message) => void entry.sent.push(message),
        dispose: () => void (entry.disposed = true),
      };
    },
  };
  return { container, opened };
}

function setup(loads: Array<'ok' | 'mismatch'> = ['ok']) {
  const listeners = new Set<(event: SessionConnectionEvent) => void>();
  const live: GameSessionPort = {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    sample: () => undefined,
    command: () => Promise.resolve({ token: 't', outcome: 'executed' }),
    currentView: () => ({ state: { round: 1 }, ack: 0 }),
    reportGameFault: () => true,
  };
  const loader: ArtifactLoader = {
    load: () =>
      Promise.resolve(
        loads.shift() === 'mismatch'
          ? { ok: false, error: { kind: 'hash-mismatch' } }
          : { ok: true, value: '<html></html>' },
      ),
  };
  const telemetry: SessionPlayTelemetry[] = [];
  const play = createSessionPlay(
    {
      participantId: 'P1',
      participants: ['P1', 'P2'],
      frontend: {
        url: 'u',
        sha256: 'h',
        viewport: { aspectRatio: '1:1', width: 1080, height: 1080 },
      },
    },
    'es',
    { live, loader, onTelemetry: (event) => telemetry.push(event) },
  );
  return { play, telemetry, listeners };
}

const ready = { bridge: 'playhoot.bridge', type: 'ready', versions: [1] };

describe('createSessionPlay', () => {
  it('runs the game in the attached container with the player context and current state', async () => {
    const t = setup();
    const box = fakeContainer();
    t.play.attach(box.container);
    await flush();
    expect(t.play.store.getState().game).toEqual({ phase: 'starting' });
    box.opened[0]!.toHost(ready);
    expect(t.play.store.getState().game).toEqual({ phase: 'running', version: 1 });
    expect(box.opened[0]!.sent[0]).toMatchObject({
      type: 'start',
      context: { participantId: 'P1', participants: ['P1', 'P2'], locale: 'es' },
      projection: { state: { round: 1 }, full: true, ack: 0 },
    });
    expect(box.opened[0]!.viewport).toEqual({ aspectRatio: '1:1', width: 1080, height: 1080 });
  });

  it('counts and reports refused game messages', async () => {
    const t = setup();
    const box = fakeContainer();
    t.play.attach(box.container);
    await flush();
    box.opened[0]!.toHost({ bridge: 'playhoot.bridge', type: 'sample', id: 1, inputs: {} });
    expect(t.play.store.getState().refusedGameMessages).toBe(1);
    expect(t.telemetry).toContainEqual({ type: 'bridge-rejected', detail: 'sample before ready' });
  });

  it('reports a failure and loads the game again on reload', async () => {
    const t = setup(['mismatch', 'ok']);
    const box = fakeContainer();
    t.play.attach(box.container);
    await flush();
    expect(t.play.store.getState().game).toEqual({
      phase: 'failed',
      error: { kind: 'artifact-hash-mismatch' },
    });
    expect(t.telemetry).toContainEqual({
      type: 'game-failed',
      error: { kind: 'artifact-hash-mismatch' },
    });
    t.play.reload();
    await flush();
    expect(t.play.store.getState().game).toEqual({ phase: 'starting' });
  });

  it('closes the game when detached or disposed, and stops listening to the Session', async () => {
    const t = setup();
    const box = fakeContainer();
    const detach = t.play.attach(box.container);
    await flush();
    box.opened[0]!.toHost(ready);
    expect(t.listeners.size).toBe(1);
    detach();
    expect(box.opened[0]!.disposed).toBe(true);
    expect(t.listeners.size).toBe(0);
    t.play.attach(box.container);
    await flush();
    t.play.dispose();
    expect(box.opened[1]!.disposed).toBe(true);
  });
});
