import { bridgeRates } from '@playhoot/protocol/bridge';
import { describe, expect, it } from 'vitest';

import { createBridgeGuard } from './bridgeGuard';

describe('createBridgeGuard', () => {
  it('allows each kind up to its rate in a second, then refuses until the next second', () => {
    const guard = createBridgeGuard();
    for (let i = 0; i < bridgeRates.command.perSecond; i += 1) {
      expect(guard.take('command', 1_000).allowed).toBe(true);
    }
    expect(guard.take('command', 1_500)).toEqual({
      allowed: false,
      abusive: false,
      firstRefusalThisSecond: true,
    });
    expect(guard.take('command', 1_600).firstRefusalThisSecond).toBe(false);
    expect(guard.take('command', 2_000).allowed).toBe(true);
    expect(guard.refused()).toEqual({ command: 2 });
  });

  it('keeps kinds apart: commands over their rate do not stop samples', () => {
    const guard = createBridgeGuard();
    for (let i = 0; i <= bridgeRates.command.perSecond; i += 1) guard.take('command', 0);
    expect(guard.take('sample', 0).allowed).toBe(true);
  });

  it('limits every message together, whatever its kind', () => {
    const guard = createBridgeGuard();
    let allowed = 0;
    for (let i = 0; i < bridgeRates.message.perSecond + 10; i += 1) {
      if (guard.take('message', 0).allowed) allowed += 1;
    }
    expect(allowed).toBe(bridgeRates.message.perSecond);
  });

  it('applies the minute window too', () => {
    const guard = createBridgeGuard();
    let allowed = 0;
    for (let second = 0; second < 60; second += 1) {
      for (let i = 0; i < bridgeRates.command.perSecond; i += 1) {
        if (guard.take('command', second * 1_000).allowed) allowed += 1;
      }
    }
    expect(allowed).toBe(bridgeRates.command.perMinute);
  });

  it('is abusive only after refusals in every one of abuseSeconds consecutive seconds', () => {
    const guard = createBridgeGuard();
    const flood = (second: number) => {
      let last = guard.take('command', second * 1_000);
      for (let i = 0; i < bridgeRates.command.perSecond; i += 1) {
        last = guard.take('command', second * 1_000);
      }
      return last;
    };
    for (let second = 0; second < bridgeRates.abuseSeconds - 1; second += 1) {
      expect(flood(second).abusive).toBe(false);
    }
    expect(flood(bridgeRates.abuseSeconds - 1).abusive).toBe(true);
  });

  it('starts counting again after a calm second', () => {
    const guard = createBridgeGuard();
    const refuseIn = (second: number) => guard.refusePending('command', second * 1_000);
    for (const second of [0, 1, 2, 3]) refuseIn(second);
    expect(refuseIn(5).abusive).toBe(false);
    for (const second of [6, 7, 8]) expect(refuseIn(second).abusive).toBe(false);
    expect(refuseIn(9).abusive).toBe(true);
  });
});
