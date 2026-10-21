// Parqués, the frontend of the backend's seed game of the same name (backend
// `play/session/internal/migrations/seed_20261020100000_parques.go`). A turn-based fixture played
// only through COMMANDs: it draws the board from the PlayerProjection, rotated so the player's own
// side is at the bottom, sends `roll` and `move`, and narrates the game events. Its text follows
// the platform locale (Spanish, English or Portuguese).
import { createPlayhoot, type Projection } from '@playhoot/game-sdk';

type Die = 'a' | 'b' | 'sum';

interface Move {
  piece: number;
  die: Die;
  to: number;
}

interface Player {
  id: string;
  seat: number;
  pieces: number[];
  connected: boolean;
}

interface View {
  board: {
    ring: number;
    side: number;
    entry: number;
    exit: number;
    safe: number[];
    lap: number;
    goal: number;
    turnMs: number;
  };
  players: Player[];
  turn: {
    player: string;
    dice: [number, number] | null;
    used: [boolean, boolean];
    pairs: number;
    jailRolls: number;
    deadline: number;
  };
  lastRoll: { player: string; dice: [number, number] } | null;
  winner: string | null;
  moves: Move[];
}

interface Point {
  x: number;
  y: number;
}

// ─── Text ──────────────────────────────────────────────────────────────────

const es = {
  colors: ['Amarillo', 'Azul', 'Rojo', 'Verde'],
  you: 'tú',
  yourRoll: 'Tu turno: lanza los dados',
  yourMove: 'Mueve una ficha',
  jailTry: (n: number) => `Intento ${n + 1} de 3 para sacar pares`,
  turnOf: (name: string) => `Turno de ${name}`,
  youWon: '¡Ganaste!',
  won: (name: string) => `¡Ganó ${name}!`,
  roll: 'Lanzar dados',
  pick: 'Elige con qué dado mover, o toca la casilla',
  sum: 'Suma',
  rolled: (name: string, a: number, b: number) => `${name} sacó ${a} y ${b}`,
  captured: (name: string, victim: string) => `${name} mandó a la cárcel una ficha de ${victim}`,
  released: (name: string) => `${name} sacó sus fichas de la cárcel`,
  crowned: (name: string) => `¡Tres pares! ${name} corona una ficha`,
  goal: (name: string) => `${name} llevó una ficha al cielo`,
  timeout: (name: string) => `${name} se quedó sin tiempo`,
  left: (name: string) => `${name} se desconectó`,
  back: (name: string) => `${name} volvió`,
  refused: {
    NOT_YOUR_TURN: 'No es tu turno',
    ALREADY_ROLLED: 'Ya lanzaste',
    ROLL_FIRST: 'Primero lanza los dados',
    DIE_USED: 'Ese dado ya se usó',
    PIECE_CANNOT_MOVE: 'Esa ficha no se puede mover',
    TOO_FAR: 'Te pasas del cielo',
    GAME_OVER: 'La partida terminó',
  } as Record<string, string>,
  failed: 'No se pudo enviar, intenta de nuevo',
};

type Texts = typeof es;

const en: Texts = {
  colors: ['Yellow', 'Blue', 'Red', 'Green'],
  you: 'you',
  yourRoll: 'Your turn: roll the dice',
  yourMove: 'Move a piece',
  jailTry: (n) => `Try ${n + 1} of 3 to roll a pair`,
  turnOf: (name) => `${name}'s turn`,
  youWon: 'You won!',
  won: (name) => `${name} won!`,
  roll: 'Roll dice',
  pick: 'Pick which die to move with, or tap the square',
  sum: 'Sum',
  rolled: (name, a, b) => `${name} rolled ${a} and ${b}`,
  captured: (name, victim) => `${name} sent a ${victim} piece to jail`,
  released: (name) => `${name} got their pieces out of jail`,
  crowned: (name) => `Three pairs! ${name} crowns a piece`,
  goal: (name) => `${name} brought a piece home`,
  timeout: (name) => `${name} ran out of time`,
  left: (name) => `${name} disconnected`,
  back: (name) => `${name} is back`,
  refused: {
    NOT_YOUR_TURN: 'Not your turn',
    ALREADY_ROLLED: 'You already rolled',
    ROLL_FIRST: 'Roll the dice first',
    DIE_USED: 'That die is used',
    PIECE_CANNOT_MOVE: 'That piece cannot move',
    TOO_FAR: 'That overshoots home',
    GAME_OVER: 'The game is over',
  },
  failed: 'Could not send, try again',
};

const pt: Texts = {
  colors: ['Amarelo', 'Azul', 'Vermelho', 'Verde'],
  you: 'você',
  yourRoll: 'Sua vez: jogue os dados',
  yourMove: 'Mova uma peça',
  jailTry: (n) => `Tentativa ${n + 1} de 3 para tirar dupla`,
  turnOf: (name) => `Vez do ${name}`,
  youWon: 'Você venceu!',
  won: (name) => `${name} venceu!`,
  roll: 'Jogar dados',
  pick: 'Escolha com qual dado mover, ou toque a casa',
  sum: 'Soma',
  rolled: (name, a, b) => `${name} tirou ${a} e ${b}`,
  captured: (name, victim) => `${name} mandou uma peça do ${victim} para a prisão`,
  released: (name) => `${name} tirou suas peças da prisão`,
  crowned: (name) => `Três duplas! ${name} coroa uma peça`,
  goal: (name) => `${name} levou uma peça ao céu`,
  timeout: (name) => `${name} ficou sem tempo`,
  left: (name) => `${name} se desconectou`,
  back: (name) => `${name} voltou`,
  refused: {
    NOT_YOUR_TURN: 'Não é a sua vez',
    ALREADY_ROLLED: 'Você já jogou',
    ROLL_FIRST: 'Jogue os dados primeiro',
    DIE_USED: 'Esse dado já foi usado',
    PIECE_CANNOT_MOVE: 'Essa peça não pode se mover',
    TOO_FAR: 'Passa do céu',
    GAME_OVER: 'A partida terminou',
  },
  failed: 'Não foi possível enviar, tente de novo',
};

// ─── Setup ─────────────────────────────────────────────────────────────────

const colors = {
  felt: '#1b2b22',
  board: '#efe6cf',
  square: '#fffaf0',
  line: '#5b4a32',
  safe: '#5b4a32',
  seats: ['#f2c230', '#2f7fd8', '#d9363e', '#2e9e57'],
  lightSeats: ['#f8e29a', '#a9c9ef', '#efa8ab', '#a5d8b6'],
  highlight: '#ffffff',
};
const dieFaces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
// Outward directions of the four sides on screen, counter-clockwise from the bottom.
const directions: Point[] = [
  { x: 0, y: 1 },
  { x: 1, y: 0 },
  { x: 0, y: -1 },
  { x: -1, y: 0 },
];

const canvas = document.getElementById('board') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const hud = {
  status: document.getElementById('status')!,
  timer: document.querySelector<HTMLElement>('#timer > div')!,
  players: document.getElementById('players')!,
  dice: document.getElementById('dice')!,
  actions: document.getElementById('actions')!,
  hint: document.getElementById('hint')!,
  log: document.getElementById('log')!,
};

const playhoot = createPlayhoot();
let t: Texts = es;
let me = '';
let view: View | null = null;
let selected: number | null = null;
let busy = false;
let turnSeen = { key: '', at: 0 };
let hint = { text: '', until: 0 };
const log: string[] = [];
// What is drawn: eases towards the projection, in board cells, so moves glide.
const drawn = new Map<string, Point>();

playhoot.onProjection((projection: Projection) => {
  view = projection.state as View;
  if (projection.full) drawn.clear();
  const key = `${view.turn.player}:${view.turn.deadline}`;
  if (key !== turnSeen.key) turnSeen = { key, at: performance.now() };
  if (selected !== null && !view.moves.some((move) => move.piece === selected)) selected = null;
  renderHud();
});

playhoot.onEvent((delivered) => {
  const event = ((delivered as { event?: unknown }).event ?? delivered) as Record<string, unknown>;
  const line = describe(event);
  if (!line) return;
  log.unshift(line);
  log.length = Math.min(log.length, 8);
  renderHud();
});

void playhoot.ready().then((context) => {
  me = context.participantId;
  const language = context.locale.toLowerCase();
  t = language.startsWith('en') ? en : language.startsWith('pt') ? pt : es;
  startInput();
  renderHud();
});

// ─── Board geometry (in cells of a 19×19 grid) ─────────────────────────────

function arm() {
  return ((view?.board.side ?? 17) - 1) / 2;
}

function centre() {
  return arm() + 1;
}

function mySeat() {
  return view?.players.find((player) => player.id === me)?.seat ?? 0;
}

// The outward direction of a side on screen, rotated so the player's own side is at the bottom.
function outward(side: number): Point {
  return directions[(((side - mySeat()) % 4) + 4) % 4]!;
}

// A side's cell at distance d from the centre and lateral column c (-1, 0 or 1).
function sideCell(side: number, d: number, c: number): Point {
  const u = outward(side);
  const v = outward(side + 1);
  const at = centre();
  return { x: at + u.x * (1 + d) + v.x * c, y: at + u.y * (1 + d) + v.y * c };
}

// A ring square's cell: each side runs out along one column, across the tip and back.
function ringCell(square: number): Point {
  const side = view?.board.side ?? 17;
  const length = arm();
  const index = square % side;
  const which = Math.floor(square / side);
  if (index < length) return sideCell(which, index + 1, -1);
  if (index === length) return sideCell(which, length, 0);
  return sideCell(which, side - index, 1);
}

function jailCentre(seat: number): Point {
  const u = outward(seat);
  const v = outward(seat + 1);
  const offset = (arm() + 3) / 2;
  return { x: centre() + (u.x + v.x) * offset, y: centre() + (u.y + v.y) * offset };
}

// Where a seat's piece at progress stands, before stacking.
function progressCell(seat: number, progress: number, piece: number): Point {
  const board = view!.board;
  if (progress < 0) {
    const at = jailCentre(seat);
    return { x: at.x + (piece % 2 ? 1 : -1) * 1.1, y: at.y + (piece < 2 ? -1 : 1) * 1.1 };
  }
  if (progress <= board.lap) {
    return ringCell((seat * board.side + board.exit + progress) % board.ring);
  }
  if (progress < board.goal) return sideCell(seat, arm() - 1 - (progress - board.lap - 1), 0);
  const u = outward(seat);
  const v = outward(seat + 1);
  const spread = (piece - 1.5) * 0.3;
  return { x: centre() + u.x * 0.75 + v.x * spread, y: centre() + u.y * 0.75 + v.y * spread };
}

// Every piece's target point, pieces sharing a square spread around it.
function piecePoints(current: View) {
  const points = new Map<string, Point>();
  const groups = new Map<string, string[]>();
  for (const player of current.players) {
    player.pieces.forEach((progress, piece) => {
      const at = progressCell(player.seat, progress, piece);
      const key = `${player.id}:${piece}`;
      points.set(key, at);
      if (progress >= 0 && progress < current.board.goal) {
        const cell = `${at.x},${at.y}`;
        groups.set(cell, [...(groups.get(cell) ?? []), key]);
      }
    });
  }
  for (const keys of groups.values()) {
    if (keys.length < 2) continue;
    keys.forEach((key, index) => {
      const at = points.get(key)!;
      const angle = (index / keys.length) * Math.PI * 2 - Math.PI / 4;
      points.set(key, { x: at.x + Math.cos(angle) * 0.22, y: at.y + Math.sin(angle) * 0.22 });
    });
  }
  return points;
}

// ─── Input → COMMAND ───────────────────────────────────────────────────────

function startInput() {
  canvas.addEventListener('pointerdown', (event) => {
    if (!view) return;
    const { left, top, cell } = layout();
    const at = {
      x: (event.clientX - canvas.getBoundingClientRect().left - left) / cell - 0.5,
      y: (event.clientY - canvas.getBoundingClientRect().top - top) / cell - 0.5,
    };
    if (selected !== null) {
      const target = options(selected).find((move) => near(targetCell(move), at, 0.55));
      if (target) {
        send(target);
        return;
      }
    }
    const mine = view.players.find((player) => player.id === me);
    const piece = mine?.pieces.findIndex(
      (_, index) =>
        view!.moves.some((move) => move.piece === index) &&
        near(drawn.get(`${me}:${index}`) ?? { x: -9, y: -9 }, at, 0.55),
    );
    if (piece === undefined || piece < 0) {
      selected = null;
    } else {
      const choices = options(piece);
      if (choices.length === 1) send(choices[0]!);
      else selected = piece;
    }
    renderHud();
  });
  addEventListener('keydown', (event) => {
    if ((event.code === 'Space' || event.code === 'Enter') && canRoll()) {
      event.preventDefault();
      roll();
    }
  });
}

function canRoll() {
  return !!view && !busy && !view.winner && view.turn.player === me && view.turn.dice === null;
}

function roll() {
  busy = true;
  renderHud();
  void playhoot.command('roll', {}).then(settle);
}

function send(move: Move) {
  if (busy) return;
  busy = true;
  selected = null;
  renderHud();
  void playhoot.command('move', { piece: move.piece, die: move.die }).then(settle);
}

function settle(result: { outcome: string; response?: unknown }) {
  busy = false;
  const response = result.response as { ok?: boolean; reason?: string } | undefined;
  if (result.outcome !== 'executed') showHint(t.failed);
  else if (!response?.ok) showHint(t.refused[response?.reason ?? ''] ?? t.failed);
  renderHud();
}

// options are the distinct moves of one piece: with pairs, both dice lead to the same square.
function options(piece: number) {
  const seen = new Set<number>();
  return (view?.moves ?? []).filter((move) => {
    if (move.piece !== piece || seen.has(move.to)) return false;
    seen.add(move.to);
    return true;
  });
}

function targetCell(move: Move) {
  return progressCell(mySeat(), move.to, move.piece);
}

function stepsOf(move: Move) {
  const dice = view?.turn.dice ?? [0, 0];
  return move.die === 'a' ? dice[0] : move.die === 'b' ? dice[1] : dice[0] + dice[1];
}

// ─── HUD ───────────────────────────────────────────────────────────────────

function renderHud() {
  if (!view) return;
  const current = view;
  const turnPlayer = current.players.find((player) => player.id === current.turn.player);
  const mine = current.players.find((player) => player.id === me);
  const myTurn = current.turn.player === me && !current.winner;

  if (current.winner) {
    hud.status.textContent = current.winner === me ? t.youWon : t.won(name(current.winner));
  } else if (myTurn && current.turn.dice) {
    hud.status.textContent = t.yourMove;
  } else if (myTurn) {
    const stuck = mine?.pieces.every((progress) => progress < 0 || progress === current.board.goal);
    hud.status.textContent =
      stuck && current.turn.jailRolls > 0 ? t.jailTry(current.turn.jailRolls) : t.yourRoll;
  } else {
    hud.status.textContent = t.turnOf(name(current.turn.player));
  }
  hud.status.style.color = turnPlayer ? colors.seats[turnPlayer.seat]! : '';

  hud.players.replaceChildren(
    ...current.players.map((player) => {
      const chip = document.createElement('span');
      chip.className = 'player';
      chip.classList.toggle('turn', player.id === current.turn.player && !current.winner);
      chip.classList.toggle('away', !player.connected);
      const swatch = document.createElement('span');
      swatch.className = 'swatch';
      swatch.style.background = colors.seats[player.seat]!;
      const home = player.pieces.filter((progress) => progress === current.board.goal).length;
      chip.append(swatch, `${name(player.id)}${player.id === me ? ` (${t.you})` : ''} ${home}/4`);
      return chip;
    }),
  );

  // The dice in play, or else the last roll, faded.
  const dice = current.turn.dice;
  hud.dice.replaceChildren(
    ...(dice ?? current.lastRoll?.dice ?? []).map((value, index) => {
      const face = document.createElement('span');
      face.textContent = dieFaces[value - 1]!;
      face.classList.toggle('used', !dice || current.turn.used[index]!);
      return face;
    }),
  );

  const buttons: HTMLButtonElement[] = [];
  if (myTurn && !dice) {
    buttons.push(button(t.roll, roll, !canRoll()));
  }
  if (myTurn && dice && selected !== null) {
    for (const move of options(selected)) {
      const label =
        move.die === 'sum'
          ? `${t.sum} ${stepsOf(move)}`
          : `${dieFaces[stepsOf(move) - 1]} ${stepsOf(move)}`;
      buttons.push(button(label, () => send(move), busy));
    }
  }
  hud.actions.replaceChildren(...buttons);
  hud.hint.textContent =
    performance.now() < hint.until ? hint.text : myTurn && selected !== null ? t.pick : '';

  hud.log.replaceChildren(
    ...log.map((line) => {
      const item = document.createElement('li');
      item.textContent = line;
      return item;
    }),
  );
}

function button(label: string, action: () => void, disabled: boolean) {
  const element = document.createElement('button');
  element.textContent = label;
  element.disabled = disabled;
  element.addEventListener('click', action);
  return element;
}

function showHint(text: string) {
  hint = { text, until: performance.now() + 2500 };
  setTimeout(renderHud, 2600);
}

function name(id: string) {
  const seat = view?.players.find((player) => player.id === id)?.seat ?? 0;
  return t.colors[seat]!;
}

function describe(event: Record<string, unknown>): string | null {
  const who = typeof event.player === 'string' ? name(event.player) : '';
  switch (event.type) {
    case 'ROLLED': {
      const [a, b] = event.dice as [number, number];
      return t.rolled(who, a, b);
    }
    case 'CAPTURED':
      return t.captured(who, name(event.victim as string));
    case 'RELEASED':
      return t.released(who);
    case 'CROWNED':
      return t.crowned(who);
    case 'GOAL':
      return t.goal(who);
    case 'TURN_TIMEOUT':
      return t.timeout(who);
    case 'PLAYER_LEFT':
      return t.left(who);
    case 'PLAYER_BACK':
      return t.back(who);
    case 'WINNER':
      return event.player === me ? t.youWon : t.won(who);
    default:
      return null;
  }
}

// ─── Rendering ─────────────────────────────────────────────────────────────

function layout() {
  const grid = 2 * arm() + 3;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const size = Math.min(width, height) * 0.96;
  return { left: (width - size) / 2, top: (height - size) / 2, size, cell: size / grid };
}

function frame(now: number) {
  const ratio = devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
  }
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.fillStyle = colors.felt;
  ctx.fillRect(0, 0, width, height);
  if (view) {
    drawBoard(view);
    drawPieces(view, now);
    const left = view.board.turnMs - (now - turnSeen.at);
    hud.timer.style.width = view.winner
      ? '0%'
      : `${Math.max(0, (left / view.board.turnMs) * 100)}%`;
  }
  requestAnimationFrame(frame);
}

function drawBoard(current: View) {
  const { left, top, size, cell } = layout();
  const board = current.board;
  const length = arm();
  ctx.save();
  ctx.translate(left, top);

  ctx.fillStyle = colors.board;
  roundRect(0, 0, size, size, cell * 0.5);
  ctx.fill();

  const turnSeat = current.players.find((player) => player.id === current.turn.player)?.seat;
  for (let seat = 0; seat < 4; seat += 1) {
    const at = jailCentre(seat);
    const half = length / 2 - 0.2;
    ctx.fillStyle = colors.lightSeats[seat]!;
    ctx.strokeStyle = colors.seats[seat]!;
    ctx.lineWidth = cell * 0.15;
    roundRect(
      (at.x + 0.5 - half) * cell,
      (at.y + 0.5 - half) * cell,
      half * 2 * cell,
      half * 2 * cell,
      cell * 0.6,
    );
    ctx.fill();
    ctx.stroke();
    if (seat === turnSeat && !current.winner) {
      ctx.strokeStyle = colors.highlight;
      ctx.lineWidth = cell * 0.12;
      ctx.stroke();
    }
    for (let d = 1; d < length; d += 1)
      square(sideCell(seat, d, 0), colors.lightSeats[seat]!, cell);
  }

  for (let index = 0; index < board.ring; index += 1) {
    const local = index % board.side;
    const side = Math.floor(index / board.side);
    const at = ringCell(index);
    square(at, local === board.exit ? colors.seats[side]! : colors.square, cell);
    if (board.safe.includes(local)) {
      ctx.strokeStyle = colors.safe;
      ctx.lineWidth = cell * 0.06;
      ctx.beginPath();
      ctx.arc((at.x + 0.5) * cell, (at.y + 0.5) * cell, cell * 0.3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  const middle = (centre() + 0.5) * cell;
  for (let seat = 0; seat < 4; seat += 1) {
    const u = outward(seat);
    const v = outward(seat + 1);
    ctx.fillStyle = colors.seats[seat]!;
    ctx.beginPath();
    ctx.moveTo(middle, middle);
    ctx.lineTo(middle + (u.x + v.x) * 1.5 * cell, middle + (u.y + v.y) * 1.5 * cell);
    ctx.lineTo(middle + (u.x - v.x) * 1.5 * cell, middle + (u.y - v.y) * 1.5 * cell);
    ctx.closePath();
    ctx.fill();
  }

  if (selected !== null) {
    ctx.setLineDash([cell * 0.15, cell * 0.1]);
    ctx.strokeStyle = colors.highlight;
    ctx.lineWidth = cell * 0.1;
    ctx.fillStyle = colors.line;
    ctx.font = `700 ${cell * 0.45}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const move of options(selected)) {
      const at = targetCell(move);
      ctx.strokeRect((at.x + 0.05) * cell, (at.y + 0.05) * cell, cell * 0.9, cell * 0.9);
      ctx.fillText(String(stepsOf(move)), (at.x + 0.5) * cell, (at.y + 0.5) * cell);
    }
    ctx.setLineDash([]);
  }
  ctx.restore();
}

function drawPieces(current: View, now: number) {
  const { left, top, cell } = layout();
  const points = piecePoints(current);
  const movable = new Set(current.moves.map((move) => move.piece));
  ctx.save();
  ctx.translate(left, top);
  for (const player of current.players) {
    player.pieces.forEach((_, piece) => {
      const key = `${player.id}:${piece}`;
      const target = points.get(key)!;
      const previous = drawn.get(key);
      const at = previous
        ? {
            x: previous.x + (target.x - previous.x) * 0.2,
            y: previous.y + (target.y - previous.y) * 0.2,
          }
        : target;
      drawn.set(key, at);
      const x = (at.x + 0.5) * cell;
      const y = (at.y + 0.5) * cell;
      const radius = cell * 0.34;
      if (player.id === me && movable.has(piece) && !busy) {
        ctx.strokeStyle = colors.highlight;
        ctx.globalAlpha = piece === selected ? 1 : 0.55 + Math.sin(now / 160) * 0.45;
        ctx.lineWidth = cell * 0.1;
        ctx.beginPath();
        ctx.arc(x, y, radius + cell * 0.12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = colors.seats[player.seat]!;
      ctx.strokeStyle = colors.line;
      ctx.lineWidth = cell * 0.06;
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = cell * 0.15;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.stroke();
    });
  }
  ctx.restore();
}

function square(at: Point, fill: string, cell: number) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = colors.line;
  ctx.lineWidth = cell * 0.04;
  ctx.fillRect(at.x * cell, at.y * cell, cell, cell);
  ctx.strokeRect(at.x * cell, at.y * cell, cell, cell);
}

function roundRect(x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function near(a: Point, b: Point, distance: number) {
  return Math.hypot(a.x - b.x, a.y - b.y) < distance;
}

requestAnimationFrame(frame);
