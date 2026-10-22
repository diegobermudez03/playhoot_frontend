import { bridgeRates } from '@playhoot/protocol/bridge';

// What the Host counts of a game's messages, by kind: sample, command, request_asset, or
// `message` for anything else (ready, unknown types).
export type GameMessageKind = 'sample' | 'command' | 'request_asset' | 'message';

export interface BridgeGuardVerdict {
  allowed: boolean;
  // The game stayed over its limits for `bridgeRates.abuseSeconds` seconds in a row: stop it.
  abusive: boolean;
  // The first refusal of its second, worth recording (later ones of the same second are not).
  firstRefusalThisSecond: boolean;
}

// Rate protection for game -> host messages (ADR-0006), checked before a message is decoded so a
// flood costs almost nothing. Fixed one-second and one-minute windows per kind, plus a window for
// every message. Refusals are counted by kind for the fault report.
export function createBridgeGuard() {
  const windows = {
    message: windowCounter(bridgeRates.message),
    sample: windowCounter(bridgeRates.sample),
    command: windowCounter(bridgeRates.command),
    request_asset: windowCounter(bridgeRates.request_asset),
  };
  const refused: Record<string, number> = {};
  let lastRefusedSecond = -Infinity;
  let streak = 0;

  return {
    // Takes room for one message of `kind` at `nowMs`.
    take(kind: GameMessageKind, nowMs: number): BridgeGuardVerdict {
      const allowed =
        windows.message.take(nowMs) && (kind === 'message' || windows[kind].take(nowMs));
      if (allowed) return { allowed, abusive: false, firstRefusalThisSecond: false };
      return refuse(kind, nowMs);
    },
    // A request refused for too many pending ones counts like a rate refusal.
    refusePending(kind: 'command' | 'request_asset', nowMs: number): BridgeGuardVerdict {
      return refuse(kind, nowMs);
    },
    // Refused messages so far, by kind.
    refused(): Record<string, number> {
      return { ...refused };
    },
  };

  function refuse(kind: GameMessageKind, nowMs: number): BridgeGuardVerdict {
    refused[kind] = (refused[kind] ?? 0) + 1;
    const second = Math.floor(nowMs / 1000);
    const first = second !== lastRefusedSecond;
    if (first) streak = second === lastRefusedSecond + 1 ? streak + 1 : 1;
    lastRefusedSecond = second;
    return {
      allowed: false,
      abusive: streak >= bridgeRates.abuseSeconds,
      firstRefusalThisSecond: first,
    };
  }
}

function windowCounter(limits: { perSecond: number; perMinute: number }) {
  let second = -1;
  let inSecond = 0;
  let minute = -1;
  let inMinute = 0;
  return {
    take(nowMs: number): boolean {
      const s = Math.floor(nowMs / 1000);
      const m = Math.floor(nowMs / 60_000);
      if (s !== second) [second, inSecond] = [s, 0];
      if (m !== minute) [minute, inMinute] = [m, 0];
      if (inSecond >= limits.perSecond || inMinute >= limits.perMinute) return false;
      inSecond += 1;
      inMinute += 1;
      return true;
    },
  };
}
