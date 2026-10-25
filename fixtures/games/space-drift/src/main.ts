// Space Drift, the frontend of the backend's seed game of the same name (backend
// `play/session/internal/migrations/seed_20261018000000_space_drift.go`). A small real game used as
// the end-to-end fixture of the GameHost and the Game SDK: it renders the PlayerProjection, sends
// the `move`/`boost` inputs as SAMPLEs and the `teleport` COMMAND, and shows game events.
// It has no text, so it needs no translations.
import { createPlayhoot, type Projection } from '@playhoot/game-sdk';

interface Ship {
  x: number;
  y: number;
  score: number;
}

interface View {
  arena: number;
  me: Ship & { vx: number; vy: number; boost: boolean; teleportReadyAt: number };
  others: Record<string, Ship>;
  star: { x: number; y: number };
  simulatedThrough: number;
}

const colors = {
  space: '#120b2e',
  grid: 'rgba(255,255,255,0.05)',
  wall: '#6c5ce7',
  me: '#ffd166',
  boost: '#ff8c42',
  others: ['#4ecdc4', '#ff6b9d', '#a29bfe', '#95e06c', '#74b9ff', '#fd79a8', '#55efc4'],
  star: '#fff3b0',
  score: '#ffffff',
  cooldown: 'rgba(255,255,255,0.35)',
  flash: '#ffffff',
};

const shipRadius = 20;
const starRadius = 15;

const canvas = document.createElement('canvas');
document.body.append(canvas);
const ctx = canvas.getContext('2d')!;

const playhoot = createPlayhoot();
// Every asset the game uses, declared once (ADR-0008).
const assets = playhoot.assets({ ship: 'image', thrust: 'audio' });
let me = '';
let roster: string[] = [];
let view: View | null = null;
// What is drawn: eases towards the projection so 10-60 updates a second look smooth.
const drawn = new Map<string, { x: number; y: number }>();
const flashes: Array<{ ship: string; until: number }> = [];
let shake = 0;
let shipImage: HTMLImageElement | null = null;
let thrustSound: HTMLAudioElement | null = null;

playhoot.onProjection((projection: Projection) => {
  view = projection.state as View;
  // A new baseline (first view or a resync): jump instead of easing from stale positions.
  if (projection.full) drawn.clear();
});

playhoot.onEvent((event) => {
  const { type, ship } = ((event as { event?: unknown }).event ?? event) as {
    type?: string;
    ship?: string;
  };
  if ((type === 'SHIP_ADRIFT' || type === 'SHIP_RECLAIMED') && ship) {
    flashes.push({ ship, until: performance.now() + 900 });
  }
});

void playhoot.ready().then((context) => {
  me = context.participantId;
  roster = context.participants;
  void playhoot
    .load(assets.ship)
    .then((url) => {
      const image = new Image();
      image.onload = () => (shipImage = image);
      image.src = url;
    })
    .catch(() => undefined); // No asset: ships are drawn as triangles.
  void playhoot
    .load(assets.thrust)
    .then((url) => (thrustSound = new Audio(url)))
    .catch(() => undefined); // No asset: boosting is silent.
  startInput();
});

// ─── Input → SAMPLE / COMMAND ──────────────────────────────────────────────

function startInput() {
  const keys = new Set<string>();
  let stick: [number, number] = [0, 0];
  let pointerStick: { id: number; x: number; y: number } | null = null;
  let touchBoost = false;
  let last = '';

  const send = () => {
    const keyMove: [number, number] = [
      (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0),
      (keys.has('down') ? 1 : 0) - (keys.has('up') ? 1 : 0),
    ];
    const move = keyMove[0] !== 0 || keyMove[1] !== 0 ? keyMove : stick;
    const inputs = { move, boost: keys.has('boost') || touchBoost };
    const snapshot = JSON.stringify(inputs);
    if (snapshot === last) return;
    if (inputs.boost && !last.includes('"boost":true') && thrustSound) {
      thrustSound.currentTime = 0;
      void thrustSound.play().catch(() => undefined);
    }
    last = snapshot;
    playhoot.sample(inputs);
  };

  const keyName = (event: KeyboardEvent) =>
    ({
      ArrowUp: 'up',
      KeyW: 'up',
      ArrowDown: 'down',
      KeyS: 'down',
      ArrowLeft: 'left',
      KeyA: 'left',
      ArrowRight: 'right',
      KeyD: 'right',
      ShiftLeft: 'boost',
      ShiftRight: 'boost',
      Space: 'boost',
    })[event.code];

  addEventListener('keydown', (event) => {
    const name = keyName(event);
    if (!name) return;
    event.preventDefault();
    keys.add(name);
    send();
  });
  addEventListener('keyup', (event) => {
    const name = keyName(event);
    if (!name) return;
    keys.delete(name);
    send();
  });
  addEventListener('blur', () => {
    keys.clear();
    send();
  });

  // Press and drag anywhere: a virtual stick centred where the press started. A second finger
  // boosts. A double click/tap teleports the ship there.
  const stickRange = 60;
  canvas.addEventListener('pointerdown', (event) => {
    canvas.setPointerCapture(event.pointerId);
    if (pointerStick) {
      touchBoost = true;
    } else {
      pointerStick = { id: event.pointerId, x: event.clientX, y: event.clientY };
    }
    send();
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!pointerStick || event.pointerId !== pointerStick.id) return;
    const dx = (event.clientX - pointerStick.x) / stickRange;
    const dy = (event.clientY - pointerStick.y) / stickRange;
    const length = Math.hypot(dx, dy);
    stick = length > 1 ? [dx / length, dy / length] : [dx, dy];
    stick = [round2(stick[0]), round2(stick[1])];
    send();
  });
  const release = (event: PointerEvent) => {
    if (pointerStick && event.pointerId === pointerStick.id) {
      pointerStick = null;
      stick = [0, 0];
    } else {
      touchBoost = false;
    }
    send();
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('dblclick', (event) => {
    const point = toArena(event.clientX, event.clientY);
    if (!point) return;
    void playhoot.command('teleport', point).then((result) => {
      const response = result.response as { ok?: boolean } | undefined;
      if (result.outcome !== 'executed' || !response?.ok) shake = performance.now() + 300;
    });
  });
}

// ─── Rendering ─────────────────────────────────────────────────────────────

function layout() {
  const arena = view?.arena ?? 1000;
  const size = Math.min(canvas.clientWidth, canvas.clientHeight);
  return {
    scale: size / arena,
    left: (canvas.clientWidth - size) / 2,
    top: (canvas.clientHeight - size) / 2,
    size,
  };
}

function toArena(clientX: number, clientY: number): { x: number; y: number } | null {
  if (!view) return null;
  const { scale, left, top } = layout();
  const x = (clientX - left) / scale;
  const y = (clientY - top) / scale;
  const min = 20;
  const max = view.arena - 20;
  return { x: Math.round(clamp(x, min, max)), y: Math.round(clamp(y, min, max)) };
}

function frame(now: number) {
  const ratio = devicePixelRatio || 1;
  const width = innerWidth;
  const height = innerHeight;
  if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
    canvas.width = width * ratio;
    canvas.height = height * ratio;
  }
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.fillStyle = colors.space;
  ctx.fillRect(0, 0, width, height);
  if (view) draw(view, now);
  requestAnimationFrame(frame);
}

function draw(current: View, now: number) {
  const { scale, left, top, size } = layout();
  ctx.save();
  ctx.translate(left, top);

  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  for (let i = 1; i < 10; i += 1) {
    const at = (size * i) / 10;
    line(at, 0, at, size);
    line(0, at, size, at);
  }
  ctx.strokeStyle = colors.wall;
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, size - 3, size - 3);

  ctx.save();
  ctx.scale(scale, scale);

  const twinkle = 1 + Math.sin(now / 180) * 0.15;
  ctx.fillStyle = colors.star;
  ctx.shadowColor = colors.star;
  ctx.shadowBlur = 20;
  starShape(current.star.x, current.star.y, starRadius * twinkle);
  ctx.shadowBlur = 0;

  for (const [id, ship] of Object.entries(current.others)) {
    const at = ease(id, ship);
    drawShip(at.x, at.y, 0, otherColor(id), false);
    flashRing(id, at, now);
  }

  const mine = ease(me, current.me);
  const heading = Math.atan2(current.me.vy, current.me.vx);
  const jitter = now < shake ? Math.sin(now / 15) * 6 : 0;
  drawShip(mine.x + jitter, mine.y, heading, colors.me, current.me.boost);
  flashRing(me, mine, now);
  const cooldown = current.me.teleportReadyAt - current.simulatedThrough;
  if (cooldown > 0) {
    ctx.strokeStyle = colors.cooldown;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(
      mine.x,
      mine.y,
      shipRadius + 10,
      -Math.PI / 2,
      -Math.PI / 2 + (cooldown / 3000) * Math.PI * 2,
    );
    ctx.stroke();
  }
  ctx.restore();

  ctx.fillStyle = colors.score;
  ctx.font = `700 ${Math.max(16, size * 0.05)}px system-ui, sans-serif`;
  ctx.textBaseline = 'top';
  ctx.fillText(`★ ${current.me.score}`, size * 0.03, size * 0.03);
  ctx.restore();
}

function ease(id: string, target: { x: number; y: number }) {
  const previous = drawn.get(id);
  const next = previous
    ? {
        x: previous.x + (target.x - previous.x) * 0.35,
        y: previous.y + (target.y - previous.y) * 0.35,
      }
    : { x: target.x, y: target.y };
  drawn.set(id, next);
  return next;
}

function drawShip(x: number, y: number, heading: number, color: string, boost: boolean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  if (boost) {
    ctx.fillStyle = colors.boost;
    ctx.beginPath();
    ctx.moveTo(-shipRadius, -8);
    ctx.lineTo(-shipRadius - 18 - Math.random() * 8, 0);
    ctx.lineTo(-shipRadius, 8);
    ctx.fill();
  }
  if (shipImage) {
    ctx.drawImage(shipImage, -shipRadius, -shipRadius, shipRadius * 2, shipRadius * 2);
  } else {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(shipRadius, 0);
    ctx.lineTo(-shipRadius * 0.8, -shipRadius * 0.7);
    ctx.lineTo(-shipRadius * 0.4, 0);
    ctx.lineTo(-shipRadius * 0.8, shipRadius * 0.7);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function flashRing(ship: string, at: { x: number; y: number }, now: number) {
  const flash = flashes.find((f) => f.ship === ship && f.until > now);
  if (!flash) return;
  const left = (flash.until - now) / 900;
  ctx.strokeStyle = colors.flash;
  ctx.globalAlpha = left;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(at.x, at.y, shipRadius + 30 * (1 - left) + 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function starShape(x: number, y: number, radius: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? radius : radius * 0.45;
    const angle = (Math.PI * i) / 5 - Math.PI / 2;
    ctx.lineTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
  }
  ctx.closePath();
  ctx.fill();
}

function otherColor(id: string) {
  const index = Math.max(0, roster.filter((p) => p !== me).indexOf(id));
  return colors.others[index % colors.others.length]!;
}

function line(x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

requestAnimationFrame(frame);
