import { describe, expect, it } from 'vitest';

import { joinEvents, playEvents, presentationError } from './classify';

describe('joinEvents', () => {
  it('counts closes, reconnections and resyncs', () => {
    expect(joinEvents({ type: 'connection-closed', kind: 'session-ended' })).toEqual([
      { name: 'connection_lost', close: 'session_ended' },
    ]);
    expect(joinEvents({ type: 'reconnected' })).toEqual([
      { name: 'reconnect', outcome: 'reconnected' },
    ]);
    expect(joinEvents({ type: 'gave-up' })).toEqual([{ name: 'reconnect', outcome: 'gave_up' }]);
    expect(joinEvents({ type: 'resync-requested' })).toEqual([{ name: 'resync' }]);
  });

  it('classifies failed outcomes as transport errors or backend rejections', () => {
    const outcome = (o: Parameters<typeof joinEvents>[0]) => joinEvents(o);
    expect(outcome({ type: 'outcome', outcome: { kind: 'unreachable' } })).toEqual([
      { name: 'error', origin: 'transport', kind: 'unreachable' },
    ]);
    expect(outcome({ type: 'outcome', outcome: { kind: 'connection-lost' } })).toEqual([
      { name: 'error', origin: 'transport', kind: 'connection_lost' },
    ]);
    expect(
      outcome({ type: 'outcome', outcome: { kind: 'rejected', reason: 'lobby_full' } }),
    ).toEqual([{ name: 'error', origin: 'backend_rejection', kind: 'lobby_full' }]);
    expect(outcome({ type: 'outcome', outcome: { kind: 'rejected', reason: 'unknown' } })).toEqual([
      { name: 'error', origin: 'backend_rejection', kind: 'rejected_unknown' },
    ]);
  });

  it('does not count ending, leaving or being replaced as errors', () => {
    for (const outcome of [
      { kind: 'left' },
      { kind: 'game-stopped' },
      { kind: 'replaced' },
      { kind: 'ended', status: 'FINISHED', endCause: 'GAME_FINISHED', beforeStart: false },
    ] as const) {
      expect(joinEvents({ type: 'outcome', outcome })).toEqual([]);
    }
  });

  it('classifies identity failures, but not a name the person typed wrong', () => {
    expect(
      joinEvents({
        type: 'identity-failed',
        error: { kind: 'rate-limited', retryAfterSeconds: 3 },
      }),
    ).toEqual([{ name: 'error', origin: 'backend_rejection', kind: 'rate_limited' }]);
    expect(joinEvents({ type: 'identity-failed', error: { kind: 'unavailable' } })).toEqual([
      { name: 'error', origin: 'transport', kind: 'network' },
    ]);
    expect(
      joinEvents({
        type: 'identity-failed',
        error: { kind: 'invalid-name', reason: 'empty', maxLength: 32 },
      }),
    ).toEqual([]);
  });
});

describe('playEvents', () => {
  it('turns load and READY times into durations, bounded', () => {
    expect(
      playEvents({ type: 'metric', name: 'artifact-load-ms', valueMs: 412.6, cached: true }),
    ).toEqual([{ name: 'artifact_load', duration_ms: 413, cached: true }]);
    expect(playEvents({ type: 'metric', name: 'ready-ms', valueMs: 9_999_999 })).toEqual([
      { name: 'game_ready', duration_ms: 600_000 },
    ]);
  });

  it('counts refused game messages by reason', () => {
    expect(playEvents({ type: 'bridge-rejected', detail: 'x', reason: 'over_limit' })).toEqual([
      { name: 'bridge_refusal', reason: 'over_limit' },
    ]);
  });

  it('classifies GameHost failures as artifact or bridge errors', () => {
    expect(playEvents({ type: 'game-failed', error: { kind: 'ready-timeout' } })).toEqual([
      { name: 'error', origin: 'artifact', kind: 'ready_timeout' },
    ]);
    expect(
      playEvents({ type: 'game-failed', error: { kind: 'bridge-abuse', refused: { sample: 1 } } }),
    ).toEqual([{ name: 'error', origin: 'bridge', kind: 'bridge_abuse' }]);
    expect(
      playEvents({ type: 'game-failed', error: { kind: 'container-violation', detail: 'x' } }),
    ).toEqual([{ name: 'error', origin: 'bridge', kind: 'container_violation' }]);
  });
});

describe('presentationError', () => {
  it('is a render failure', () => {
    expect(presentationError()).toEqual({
      name: 'error',
      origin: 'presentation',
      kind: 'render_failed',
    });
  });
});
