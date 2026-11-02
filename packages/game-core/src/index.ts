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
