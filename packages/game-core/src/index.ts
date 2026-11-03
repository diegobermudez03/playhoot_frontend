// What a game's server and client share: the declarations of its commands and inputs. Bundled into
// both artifacts, so it follows the backend compile profile `sdk-v1`: at the top level only
// functions and constants. Responsibility and boundaries: see ../README.md.

// A field of a command payload or of the player's inputs: the types the backend manifest takes.
// A string array is an enum whose first value is its default.
export type Field =
  | 'boolean'
  | 'number'
  | 'string'
  | 'vector2'
  | readonly [string, ...string[]]
  | { type: 'boolean'; default?: boolean }
  | { type: 'number'; min?: number; max?: number; default?: number }
  | { type: 'string'; nullable?: boolean; default?: string | null }
  | { type: 'vector2'; default?: readonly [number, number] }
  | { type: 'enum'; values: readonly [string, ...string[]]; default?: string };

export type Fields = Readonly<Record<string, Field>>;

export type ValueOf<F> = F extends 'boolean'
  ? boolean
  : F extends 'number'
    ? number
    : F extends 'string'
      ? string
      : F extends 'vector2'
        ? [number, number]
        : F extends readonly (infer V)[]
          ? V
          : F extends { type: 'enum'; values: readonly (infer V)[] }
            ? V
            : F extends { type: 'string'; nullable: true }
              ? string | null
              : F extends { type: infer T }
                ? ValueOf<T>
                : never;

export type ValuesOf<F extends Fields> = { -readonly [K in keyof F]: ValueOf<F[K]> };

export interface Command<Name extends string = string, F extends Fields = Fields> {
  readonly name: Name;
  readonly payload: F;
}

export type Commands<C extends Readonly<Record<string, Fields>>> = {
  readonly [K in keyof C & string]: Command<K, C[K]>;
};

// The game's commands, name to payload fields: `defineCommands({ answer: { choice: 'number' } })`.
// Each entry knows its name, so the client sends `useCommand(commands.answer)`.
export function defineCommands<const C extends Readonly<Record<string, Fields>>>(
  declared: C,
): Commands<C> {
  const result: Record<string, Command> = {};
  for (const name of Object.keys(declared)) {
    result[name] = { name, payload: declared[name] ?? {} };
  }
  return result as Commands<C>;
}

// The player's continuous inputs (held keys, a joystick), sent as whole snapshots.
export function defineInputs<const F extends Fields>(declared: F): F {
  return declared;
}

// The manifest's form of a field (`play/session/internal/business/manifest` in the backend).
export interface ManifestField {
  type: 'boolean' | 'number' | 'string' | 'vector2' | 'enum';
  nullable?: boolean;
  min?: number;
  max?: number;
  values?: string[];
  default?: unknown;
}

export function manifestField(field: Field): ManifestField {
  if (typeof field === 'string') return { type: field };
  if (Array.isArray(field)) {
    const values = [...(field as readonly string[])];
    return { type: 'enum', values, default: values[0] };
  }
  const declared = field as Exclude<Field, string | readonly string[]>;
  const result: ManifestField = { type: declared.type };
  if (declared.type === 'enum') {
    result.values = [...declared.values];
    result.default = declared.default ?? declared.values[0];
  }
  if (declared.type === 'number') {
    if (declared.min !== undefined) result.min = declared.min;
    if (declared.max !== undefined) result.max = declared.max;
  }
  if (declared.type === 'string' && declared.nullable) result.nullable = true;
  if (declared.type !== 'enum' && declared.default !== undefined) result.default = declared.default;
  return result;
}

export function manifestFields(fields: Fields): Record<string, ManifestField> {
  const result: Record<string, ManifestField> = {};
  for (const name of Object.keys(fields)) {
    const field = fields[name];
    if (field !== undefined) result[name] = manifestField(field);
  }
  return result;
}

// A field a value broke, as the backend reports it.
export interface FieldIssue {
  field: string;
  message: string;
}

export type Validation<T> = { ok: true; value: T } | { ok: false; issues: FieldIssue[] };

// The longest string field, in UTF-8 bytes (the backend's limit).
export const maxStringBytes = 256;

// Checks values against their fields exactly as the backend does before a game sees them
// (`play/internal/business/inputs` in ../playhoot): every field filled with its value or its
// default, nothing undeclared. The shared test vectors keep both sides equal.
export function validateValues<F extends Fields>(
  fields: F,
  given: unknown,
): Validation<ValuesOf<F>> {
  if (typeof given !== 'object' || given === null || Array.isArray(given)) {
    return { ok: false, issues: [{ field: '', message: 'must be an object' }] };
  }
  const values = given as Record<string, unknown>;
  const issues: FieldIssue[] = [];
  for (const name of Object.keys(values)) {
    if (fields[name] === undefined) issues.push({ field: name, message: 'is not declared' });
  }
  const result: Record<string, unknown> = {};
  for (const name of Object.keys(fields).sort()) {
    const field = fields[name];
    if (field === undefined) continue;
    const declared = manifestField(field);
    if (!(name in values) || values[name] === undefined) {
      result[name] = defaultOf(declared);
      continue;
    }
    const checked = canonicalValue(declared, values[name]);
    if (typeof checked === 'string') issues.push({ field: name, message: checked });
    else result[name] = checked.value;
  }
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: result as ValuesOf<F> };
}

// What every field holds when nothing was sent.
export function defaultValues<F extends Fields>(fields: F): ValuesOf<F> {
  const result: Record<string, unknown> = {};
  for (const name of Object.keys(fields)) {
    const field = fields[name];
    if (field !== undefined) result[name] = defaultOf(manifestField(field));
  }
  return result as ValuesOf<F>;
}

function defaultOf(field: ManifestField): unknown {
  if (field.default !== undefined) return field.default;
  if (field.type === 'boolean') return false;
  if (field.type === 'number') return 0;
  if (field.type === 'vector2') return [0, 0];
  if (field.type === 'string') return field.nullable ? null : '';
  return field.values?.[0];
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

// The value the backend keeps for value, or why it refuses it. Like the backend's JSON decoding, a
// null boolean is false and a null number (also inside a vector2) is 0.
function canonicalValue(field: ManifestField, value: unknown): { value: unknown } | string {
  if (field.type === 'boolean') {
    if (value === null) return { value: false };
    return typeof value === 'boolean' ? { value } : 'must be a boolean';
  }
  if (field.type === 'number') {
    const number = value === null ? 0 : value;
    if (!finite(number)) return 'must be a finite number';
    if (
      (field.min !== undefined && number < field.min) ||
      (field.max !== undefined && number > field.max)
    ) {
      return 'is out of range';
    }
    return { value: number };
  }
  if (field.type === 'vector2') {
    if (!Array.isArray(value) || value.length !== 2) return 'must be two numbers';
    const [x, y] = (value as unknown[]).map((part) => (part === null ? 0 : part));
    return finite(x) && finite(y) ? { value: [x, y] } : 'must be two finite numbers';
  }
  if (field.type === 'string') {
    if (value === null) return field.nullable ? { value: null } : 'must be a string';
    if (typeof value !== 'string') return 'must be a string';
    return utf8Length(value) > maxStringBytes
      ? `must hold at most ${maxStringBytes} bytes`
      : { value };
  }
  return typeof value === 'string' && (field.values ?? []).includes(value)
    ? { value }
    : 'must be one of its values';
}

// What the backend refuses in a runtime manifest, field by field (`path` names the declaration,
// e.g. `commands.guess.payload.value`), and each field's default as the backend keeps it.
export interface ManifestIssue {
  path: string;
  message: string;
}

export type ManifestCheck =
  | {
      ok: true;
      defaults: {
        inputs: Record<string, unknown>;
        commands: Record<string, Record<string, unknown>>;
      };
    }
  | { ok: false; issues: ManifestIssue[] };

// The most inputs and commands a manifest declares (`inputs.MaxInputs`, `commands.MaxCommands`).
export const maxInputs = 32;
export const maxCommands = 64;

// Checks a runtime manifest exactly as the backend parses it before storing a version
// (`play/session/internal/business/manifest` with `play/internal/business/inputs` and
// `commands` in ../playhoot). The shared declaration vectors keep both sides equal.
export function validateManifest(manifest: unknown): ManifestCheck {
  const issues: ManifestIssue[] = [];
  const issue = (path: string, message: string) => issues.push({ path, message });
  const defaults = {
    inputs: {} as Record<string, unknown>,
    commands: {} as Record<string, Record<string, unknown>>,
  };
  if (!isObject(manifest))
    return { ok: false, issues: [{ path: '', message: 'must be an object' }] };
  if (manifest.schema_version !== 1) issue('schema_version', 'must be 1');
  const players = manifest.players;
  if (!isObject(players)) {
    issue('players', 'is required');
  } else {
    const min = typeof players.min === 'number' ? players.min : 0;
    const max = typeof players.max === 'number' ? players.max : 0;
    if (min < 1 || max < min)
      issue('players', `must satisfy 1 <= min <= max, got min ${min} max ${max}`);
  }
  const inputs = manifest.inputs ?? {};
  if (!isObject(inputs)) issue('inputs', 'must be an object');
  else defaults.inputs = checkFields('inputs', inputs, maxInputs, issue);
  const commands = manifest.commands ?? {};
  if (!isObject(commands)) {
    issue('commands', 'must be an object');
  } else {
    const names = Object.keys(commands);
    if (names.length > maxCommands)
      issue('commands', `at most ${maxCommands} commands, got ${names.length}`);
    for (const name of names) {
      if (!validName(name))
        issue(
          `commands.${name}`,
          'names start with a letter and hold up to 64 letters, digits or underscores',
        );
      const command = commands[name];
      if (!isObject(command)) {
        issue(`commands.${name}`, 'must be an object');
        continue;
      }
      const payload = command.payload ?? {};
      if (!isObject(payload)) issue(`commands.${name}.payload`, 'must be an object');
      else
        defaults.commands[name] = checkFields(
          `commands.${name}.payload`,
          payload,
          maxInputs,
          issue,
        );
    }
  }
  const entrypoints = manifest.entrypoints ?? [];
  if (!Array.isArray(entrypoints)) {
    issue('entrypoints', 'must be a list');
  } else {
    const seen = new Set<unknown>();
    for (const entrypoint of entrypoints) {
      if (entrypoint !== 'update' && entrypoint !== 'playerRejoined')
        issue('entrypoints', `unknown optional entrypoint ${JSON.stringify(entrypoint)}`);
      else if (seen.has(entrypoint))
        issue('entrypoints', `entrypoint ${JSON.stringify(entrypoint)} is declared twice`);
      seen.add(entrypoint);
    }
  }
  return issues.length > 0 ? { ok: false, issues } : { ok: true, defaults };
}

function checkFields(
  path: string,
  fields: Record<string, unknown>,
  limit: number,
  issue: (path: string, message: string) => void,
): Record<string, unknown> {
  const names = Object.keys(fields);
  if (names.length > limit) issue(path, `at most ${limit} inputs, got ${names.length}`);
  const defaults: Record<string, unknown> = {};
  for (const name of names) {
    const checked = checkDeclaration(name, fields[name]);
    if (typeof checked === 'string') issue(`${path}.${name}`, checked);
    else defaults[name] = checked.default;
  }
  return defaults;
}

// One field declaration as the backend's inputs.Validate decides it: the reason it is refused, or
// its default in canonical form.
function checkDeclaration(name: string, declared: unknown): { default: unknown } | string {
  if (!validName(name))
    return 'names start with a letter and hold up to 64 letters, digits or underscores';
  if (!isObject(declared)) return 'must be an object';
  const type = declared.type;
  const min = typeof declared.min === 'number' ? declared.min : undefined;
  const max = typeof declared.max === 'number' ? declared.max : undefined;
  const values = Array.isArray(declared.values) ? (declared.values as unknown[]) : [];
  const nullable = declared.nullable === true;
  const hasDefault = 'default' in declared && declared.default !== undefined;
  if (type === 'number') {
    if (min !== undefined && max !== undefined && min > max) return 'min must not exceed max';
  } else if (type === 'enum') {
    if (values.length === 0) return 'an enum declares its values';
    const seen = new Set<unknown>();
    for (const value of values) {
      if (value === '' || seen.has(value)) return 'enum values must be distinct and not empty';
      seen.add(value);
    }
    if (!hasDefault) return 'an enum has no natural zero, so it declares a default';
  } else if (type !== 'boolean' && type !== 'vector2' && type !== 'string') {
    return `unknown type ${JSON.stringify(type)}`;
  }
  if (type !== 'number' && (min !== undefined || max !== undefined))
    return 'only number inputs take min and max';
  if (type !== 'string' && nullable) return 'only string inputs may be nullable';
  if (type !== 'enum' && values.length > 0) return 'only enum inputs take values';
  const field: ManifestField = { type: type as ManifestField['type'], nullable };
  if (min !== undefined) field.min = min;
  if (max !== undefined) field.max = max;
  if (type === 'enum') field.values = values as string[];
  const zero =
    type === 'boolean'
      ? false
      : type === 'number'
        ? 0
        : type === 'vector2'
          ? [0, 0]
          : nullable
            ? null
            : '';
  const checked = canonicalValue(field, hasDefault ? declared.default : zero);
  if (typeof checked === 'string') {
    return hasDefault
      ? `default: ${checked}`
      : `its natural zero ${JSON.stringify(zero)} is not a valid value, so it declares a default`;
  }
  return { default: checked.value };
}

function validName(name: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(name);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function utf8Length(text: string): number {
  let bytes = 0;
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}

// What a player's view carries about the current phase when the game declares phases: the
// platform adds it to every view under `phase`, so the client never computes it. `secondsLeft` is
// the time left in whole seconds, rounded up (null: no deadline), updated once a second by the
// server, the only clock; `submitted` lists who has
// sent their submission; `mine` is this player's own submission, never anybody else's.
export interface PhaseView<Name extends string = string, Submission = unknown> {
  name: Name;
  // Counts every phase entered since the game started: commands carrying an older one are stale.
  id: number;
  // How many times this phase has been entered, from 1 (the question number, say).
  round: number;
  secondsLeft: number | null;
  submitted: string[];
  mine: Submission | null;
}

// Points per player. A plain object kept in the game state.
export type Scores = Record<string, number>;

// Adds points to a player (negative points subtract), creating their entry when missing.
export function addPoints(scores: Scores, player: string, points: number): void {
  scores[player] = (scores[player] ?? 0) + points;
}

export interface Standing {
  player: string;
  points: number;
  // 1 for the best; tied players share a rank and the next rank skips them (1, 1, 3).
  rank: number;
}

// Players ordered by points, best first, ties sharing their rank; players without an entry count 0.
// Equal points keep the order of `players` (or of the scores when not given).
export function ranking(scores: Scores, players?: readonly string[]): Standing[] {
  const order = players ?? Object.keys(scores);
  const sorted = order
    .map((player, index) => ({ player, points: scores[player] ?? 0, index }))
    .sort((a, b) => b.points - a.points || a.index - b.index);
  const standings: Standing[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];
    if (entry === undefined) continue;
    const previous = standings[i - 1];
    const rank = previous !== undefined && previous.points === entry.points ? previous.rank : i + 1;
    standings.push({ player: entry.player, points: entry.points, rank });
  }
  return standings;
}

// The languages Playhoot is offered in (app-core's supportedLocales; a test keeps both equal). A
// game declares in game.project.json the ones it is written in, the first being its main language.
export const gameLanguages = ['es', 'en', 'pt-BR'] as const;
export type GameLanguage = (typeof gameLanguages)[number];

// The language a game shows a player: the player's Playhoot language when the game is written in
// it (the same tag, or the same language: `pt` matches `pt-BR`), otherwise the game's main one.
export function effectiveLanguage(
  languages: readonly [GameLanguage, ...GameLanguage[]],
  locale: string,
): GameLanguage {
  const wanted = locale.toLowerCase();
  const exact = languages.find((language) => language.toLowerCase() === wanted);
  if (exact !== undefined) return exact;
  const base = wanted.split('-')[0];
  const same = languages.find((language) => language.split('-')[0]?.toLowerCase() === base);
  return same ?? languages[0];
}
