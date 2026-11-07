// A project's brief.json (playhoot.brief.v1): the game agreed with the person, kept while it is
// written, and the phase the work is in. The backend checks the same rules when the file is
// written (play/session/internal/business/gamebrief); the shared vectors keep both alike.

export const briefFormat = 'playhoot.brief.v1';

// The phases of the work, in order. A brief without one is in `brief`.
export const briefPhases = [
  'brief',
  'foundation',
  'building',
  'testing',
  'assets',
  'ready',
] as const;

export type BriefPhase = (typeof briefPhases)[number];

export interface Brief {
  format: typeof briefFormat;
  phase?: BriefPhase;
  players?: { min: number; max: number };
  goal?: string;
  loop?: string;
  actions?: string[];
  private_information?: string[];
  rounds?: string;
  scoring?: string;
  ending?: string;
  capabilities?: string[];
  assets?: string[];
  assessment?: string;
  open_questions?: string[];
}

export const briefLimits = { text: 2000, items: 50, item: 500, players: 1000 } as const;

const briefTextFields = ['goal', 'loop', 'rounds', 'scoring', 'ending', 'assessment'] as const;
const briefListFields = [
  'actions',
  'private_information',
  'capabilities',
  'assets',
  'open_questions',
] as const;

// One reason a value is not a valid brief; `field` is empty for the whole document.
export interface BriefProblem {
  field: string;
  message: string;
}

export type BriefCheck =
  { ok: true; brief: Brief; phase: BriefPhase } | { ok: false; problems: BriefProblem[] };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPhase(value: unknown): value is BriefPhase {
  return typeof value === 'string' && (briefPhases as readonly string[]).includes(value);
}

function characters(text: string): number {
  return [...text].length;
}

// Checks `value` (brief.json parsed) against playhoot.brief.v1, listing every problem by field.
export function validateBrief(value: unknown): BriefCheck {
  const problems: BriefProblem[] = [];
  const add = (field: string, message: string) => problems.push({ field, message });
  if (!isObject(value))
    return { ok: false, problems: [{ field: '', message: 'a brief is one JSON object' }] };

  const known = new Set<string>([
    'format',
    'phase',
    'players',
    ...briefTextFields,
    ...briefListFields,
  ]);
  for (const name of Object.keys(value)) {
    if (!known.has(name)) add(name, 'is not a field of a brief');
  }
  if (value.format !== briefFormat) add('format', `must be ${briefFormat}`);
  let phase: BriefPhase = 'brief';
  if ('phase' in value) {
    if (isPhase(value.phase)) phase = value.phase;
    else add('phase', 'is one of brief, foundation, building, testing, assets, ready');
  }
  if ('players' in value) checkPlayers(value.players, add);
  const text = (field: string, item: unknown, limit: number) => {
    if (typeof item !== 'string') add(field, 'is a text');
    else if (characters(item) > limit) add(field, `holds at most ${limit} characters`);
  };
  for (const name of briefTextFields) {
    if (name in value) text(name, value[name], briefLimits.text);
  }
  for (const name of briefListFields) {
    if (!(name in value)) continue;
    const list = value[name];
    if (!Array.isArray(list)) {
      add(name, 'is a list of texts');
      continue;
    }
    if (list.length > briefLimits.items) add(name, `holds at most ${briefLimits.items} items`);
    list.forEach((item: unknown, i) => text(`${name}[${i}]`, item, briefLimits.item));
  }
  if (problems.length > 0) {
    // By field, as the backend lists them.
    problems.sort((a, b) => (a.field < b.field ? -1 : a.field > b.field ? 1 : 0));
    return { ok: false, problems };
  }
  return { ok: true, brief: value as unknown as Brief, phase };
}

function checkPlayers(players: unknown, add: (field: string, message: string) => void) {
  if (!isObject(players)) {
    add('players', 'is {"min": n, "max": m}');
    return;
  }
  const bounds: Record<string, number> = {};
  for (const name of ['min', 'max']) {
    const value = players[name];
    if (
      typeof value !== 'number' ||
      !Number.isInteger(value) ||
      value < 1 ||
      value > briefLimits.players
    ) {
      add(`players.${name}`, `is a whole number from 1 to ${briefLimits.players}`);
      continue;
    }
    bounds[name] = value;
  }
  for (const name of Object.keys(players)) {
    if (name !== 'min' && name !== 'max') add(`players.${name}`, 'is not a field of players');
  }
  if (bounds.min !== undefined && bounds.max !== undefined && bounds.min > bounds.max) {
    add('players', 'min is at most max');
  }
}
