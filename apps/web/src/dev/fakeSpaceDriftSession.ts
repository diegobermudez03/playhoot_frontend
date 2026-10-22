import type { SessionConnectionEvent } from '@playhoot/communication';
import type { GameSessionPort } from '@playhoot/game-host';

// Development only: a stand-in for a live Space Drift Session, so the GameHost and the Game SDK can
// be exercised in a real browser without a backend. It imitates the backend game's projection
// (`seed_20261018000000_space_drift.go`) roughly: one ship for the player, one bot ship, a star.
// It is not the game's logic; the backend is.
export interface FakeSession extends GameSessionPort {
  // Sends a FULL view, as after a resync.
  resync(): void;
  dispose(): void;
  readonly log: string[];
}

const arena = 1000;
const tickMs = 50;

export function createFakeSpaceDriftSession(me: string, bot: string): FakeSession {
  const listeners = new Set<(event: SessionConnectionEvent) => void>();
  const log: string[] = [];
  let time = 0;
  let sequence = 0;
  let consumed = 0;
  let revision = 0;
  let inputs = { move: [0, 0] as number[], boost: false };
  const ship = { x: 200, y: 500, vx: 0, vy: 0, score: 0, teleportReadyAt: 0 };
  const botShip = { x: 800, y: 500, score: 0, adrift: false };
  let star = { x: 500, y: 300 };
  let events: unknown[] = [];

  const emit = (event: SessionConnectionEvent) => listeners.forEach((listener) => listener(event));
  const projection = () => ({
    arena,
    simulatedThrough: time,
    me: {
      x: Math.round(ship.x),
      y: Math.round(ship.y),
      vx: Math.round(ship.vx),
      vy: Math.round(ship.vy),
      boost: inputs.boost,
      score: ship.score,
      teleportReadyAt: ship.teleportReadyAt,
    },
    others: { [bot]: { x: Math.round(botShip.x), y: Math.round(botShip.y), score: botShip.score } },
    star,
    collected: ship.score + botShip.score,
  });
  const view = (full: boolean) => {
    revision += 1;
    const sent = events;
    events = [];
    emit({
      type: 'view',
      update: {
        kind: 'state',
        full,
        state: projection(),
        revision,
        ack: consumed,
        events: sent,
        errors: [],
      },
    });
  };

  const tick = () => {
    time += tickMs;
    const dt = tickMs / 1000;
    const thrust = 400 * (inputs.boost ? 2 : 1);
    const [mx = 0, my = 0] = inputs.move;
    ship.vx = (ship.vx + mx * thrust * dt) * (1 - 1.5 * dt);
    ship.vy = (ship.vy + my * thrust * dt) * (1 - 1.5 * dt);
    ship.x = Math.min(Math.max(ship.x + ship.vx * dt, 20), arena - 20);
    ship.y = Math.min(Math.max(ship.y + ship.vy * dt, 20), arena - 20);
    if (!botShip.adrift) {
      botShip.x = 500 + Math.cos(time / 2000) * 300;
      botShip.y = 500 + Math.sin(time / 2000) * 300;
    }
    if (Math.hypot(ship.x - star.x, ship.y - star.y) < 35) {
      ship.score += 1;
      star = { x: 50 + Math.random() * 900, y: 50 + Math.random() * 900 };
    }
    if (time % 8000 === 0) {
      botShip.adrift = !botShip.adrift;
      // As the backend delivers them: the game's `event` value alone.
      events.push({ type: botShip.adrift ? 'SHIP_ADRIFT' : 'SHIP_RECLAIMED', ship: bot });
    }
    view(false);
  };
  const interval = setInterval(tick, tickMs);

  return {
    log,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    currentView: () => ({ state: projection(), ack: consumed }),
    reportGameFault(kind, detail) {
      log.unshift(`game fault ${kind} ${JSON.stringify(detail)}`);
      return true;
    },
    sample(next) {
      sequence += 1;
      consumed = sequence;
      inputs = next as typeof inputs;
      log.unshift(`sample #${sequence} ${JSON.stringify(next)}`);
      emit({ type: 'sample-sent', sequence });
    },
    command(name, payload) {
      log.unshift(`command ${name} ${JSON.stringify(payload)}`);
      if (name !== 'teleport') return Promise.resolve({ token: 'fake', outcome: 'invalid' });
      if (time < ship.teleportReadyAt) {
        const response = { ok: false, reason: 'COOLDOWN', retryInMs: ship.teleportReadyAt - time };
        return Promise.resolve({ token: 'fake', outcome: 'executed', response });
      }
      const { x, y } = payload as { x: number; y: number };
      Object.assign(ship, { x, y, vx: 0, vy: 0, teleportReadyAt: time + 3000 });
      return Promise.resolve({ token: 'fake', outcome: 'executed', response: { ok: true, x, y } });
    },
    resync: () => view(true),
    dispose() {
      clearInterval(interval);
      listeners.clear();
    },
  };
}
