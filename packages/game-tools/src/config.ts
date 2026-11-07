// Template configuration: the values a game exposes so it can be reused by changing data, not
// code. `game.project.json` "config" declares each value (its type, limits, description and
// default); `config.json` holds the values. The build checks both and generates two modules:
// `@playhoot/config` (every area; private values left out) and `@playhoot/config/server` (server/
// only; everything). Rules: see apps/web/public/docs/sdk/v1/config.md.
import type { GameLanguage } from '@playhoot/game-core';

export const configFile = 'config.json';
export const configFormat = 'playhoot.config.v1';

const keyPattern = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const maxFields = 50;
const maxDescriptionLength = 300;
const maxChoiceOptions = 50;
const maxChoiceLength = 64;
const defaultTextLength = 500;
const maxTextLength = 2000;
const defaultListItems = 100;
const maxListItems = 500;
// How deep lists and objects may nest inside a top-level value.
const maxDepth = 4;

export type ConfigField =
  | (Common & { type: 'number'; min?: number; max?: number; integer: boolean })
  | (Common & { type: 'boolean' })
  | (Common & { type: 'choice'; options: string[] })
  | (Common & { type: 'text'; maxLength: number; translated: boolean })
  | (Common & { type: 'list'; items: ConfigField; minItems: number; maxItems: number })
  | (Common & { type: 'object'; fields: Record<string, ConfigField> });

interface Common {
  description: string;
  private: boolean;
}

export interface Config {
  // The declared values by key, in declaration order.
  schema: Record<string, ConfigField>;
  // The values: config.json's, or each one's default.
  values: Record<string, unknown>;
}

type Problem = (message: string, file?: string) => void;

// A problem callback that counts what it reported, so a caller can tell whether a part added any.
interface Reporter {
  (message: string): void;
  count: number;
}

function reporter(report: (message: string) => void): Reporter {
  const counted = ((message: string) => {
    counted.count += 1;
    report(message);
  }) as Reporter;
  counted.count = 0;
  return counted;
}

// Reads the "config" declaration and the values in config.json (null when the file is absent),
// reporting every problem. languages are the game's: a translated text holds one per language.
export function loadConfig(
  declared: unknown,
  valuesText: string | null,
  languages: readonly GameLanguage[],
  problem: Problem,
): Config {
  const schemaProblem = reporter((message) => problem(message, 'game.project.json'));
  const valueProblem = (message: string) => problem(message, configFile);
  const schema: Record<string, ConfigField> = {};
  const values: Record<string, unknown> = {};
  // Keys declared, valid or not: a value for an invalid declaration is not reported again.
  const declaredKeys = new Set(isObject(declared) ? Object.keys(declared) : []);
  if (declared !== undefined && !isObject(declared)) {
    schemaProblem('"config" is an object of value keys');
  } else if (isObject(declared)) {
    const fields = readFields(declared, 'config', 0, schemaProblem);
    for (const [key, field] of Object.entries(fields ?? {})) {
      const raw = (declared[key] as Record<string, unknown>).default;
      if (raw === undefined) {
        schema[key] = field;
      } else if (checkValue(field, raw, `config.${key}.default`, languages, schemaProblem)) {
        schema[key] = field;
        values[key] = raw;
      }
    }
  }

  const set = readValues(valuesText, valueProblem);
  for (const [key, value] of Object.entries(set ?? {})) {
    const field = schema[key];
    if (field === undefined) {
      if (!declaredKeys.has(key)) {
        valueProblem(
          `"${key}" is not declared in game.project.json "config"${declared === undefined ? ' (it declares none)' : ''}`,
        );
      }
      continue;
    }
    if (checkValue(field, value, key, languages, valueProblem)) values[key] = value;
  }
  // An unreadable config.json was reported already; an absent one sets nothing.
  if (set !== null || valuesText === null) {
    for (const key of Object.keys(schema)) {
      if (!(key in values) && !(set !== null && key in set)) {
        valueProblem(`"${key}" has no default in game.project.json, so config.json must set it`);
      }
    }
  }
  return { schema, values };
}

// config.json's values (null when the file is absent or unreadable, reported).
function readValues(
  text: string | null,
  problem: (message: string) => void,
): Record<string, unknown> | null {
  if (text === null) return null;
  let document: unknown;
  try {
    document = JSON.parse(text);
  } catch (error) {
    problem(`config.json is not JSON: ${(error as Error).message}`);
    return null;
  }
  if (!isObject(document) || document.format !== configFormat || !isObject(document.values)) {
    problem(`config.json is {"format": "${configFormat}", "values": {...}}`);
    return null;
  }
  return document.values;
}

function readFields(
  declared: Record<string, unknown>,
  at: string,
  depth: number,
  problem: Reporter,
): Record<string, ConfigField> | null {
  const keys = Object.keys(declared);
  if (keys.length > maxFields) {
    problem(`${at}: at most ${maxFields} values`);
    return null;
  }
  const fields: Record<string, ConfigField> = {};
  for (const key of keys) {
    if (!keyPattern.test(key)) {
      problem(
        `${at}.${key}: keys start with a letter and hold up to 64 letters, digits or underscores`,
      );
      continue;
    }
    const field = readField(declared[key], `${at}.${key}`, depth, problem);
    if (field !== null) fields[key] = field;
  }
  return fields;
}

function readField(
  declared: unknown,
  at: string,
  depth: number,
  problem: Reporter,
): ConfigField | null {
  if (!isObject(declared)) {
    problem(`${at}: each value is an object {"type", "description", "default", ...}`);
    return null;
  }
  const description = typeof declared.description === 'string' ? declared.description.trim() : '';
  if (description === '' || description.length > maxDescriptionLength) {
    problem(
      `${at}: "description" says what the value is, in 1 to ${maxDescriptionLength} characters`,
    );
    return null;
  }
  if (declared.private !== undefined && typeof declared.private !== 'boolean') {
    problem(`${at}: "private" is true or false`);
    return null;
  }
  if (depth > 0 && declared.default !== undefined) {
    problem(`${at}: only top-level values have a "default"; a list's default holds its items`);
    return null;
  }
  const common = { description, private: declared.private === true };
  switch (declared.type) {
    case 'number': {
      const { min, max, integer } = declared;
      if (min !== undefined && !isFiniteNumber(min))
        return refuse(problem, at, '"min" is a number');
      if (max !== undefined && !isFiniteNumber(max))
        return refuse(problem, at, '"max" is a number');
      if (isFiniteNumber(min) && isFiniteNumber(max) && min > max) {
        return refuse(problem, at, '"min" is at most "max"');
      }
      if (integer !== undefined && typeof integer !== 'boolean') {
        return refuse(problem, at, '"integer" is true or false');
      }
      return {
        ...common,
        type: 'number',
        ...(isFiniteNumber(min) ? { min } : {}),
        ...(isFiniteNumber(max) ? { max } : {}),
        integer: integer === true,
      };
    }
    case 'boolean':
      return { ...common, type: 'boolean' };
    case 'choice': {
      const { options } = declared;
      if (
        !Array.isArray(options) ||
        options.length === 0 ||
        options.length > maxChoiceOptions ||
        options.some(
          (option) =>
            typeof option !== 'string' || option.length === 0 || option.length > maxChoiceLength,
        ) ||
        new Set(options).size !== options.length
      ) {
        return refuse(
          problem,
          at,
          `"options" lists 1 to ${maxChoiceOptions} different strings of 1 to ${maxChoiceLength} characters`,
        );
      }
      return { ...common, type: 'choice', options: options as string[] };
    }
    case 'text': {
      const { maxLength, translated } = declared;
      if (
        maxLength !== undefined &&
        (!Number.isInteger(maxLength) ||
          (maxLength as number) < 1 ||
          (maxLength as number) > maxTextLength)
      ) {
        return refuse(problem, at, `"maxLength" is a whole number from 1 to ${maxTextLength}`);
      }
      if (translated !== undefined && typeof translated !== 'boolean') {
        return refuse(problem, at, '"translated" is true or false');
      }
      return {
        ...common,
        type: 'text',
        maxLength: (maxLength as number | undefined) ?? defaultTextLength,
        translated: translated === true,
      };
    }
    case 'list': {
      if (depth >= maxDepth)
        return refuse(problem, at, `lists and objects nest at most ${maxDepth} deep`);
      const { minItems, maxItems } = declared;
      const min = (minItems ?? 0) as number;
      const max = (maxItems ?? defaultListItems) as number;
      if (
        !Number.isInteger(min) ||
        !Number.isInteger(max) ||
        min < 0 ||
        max < 1 ||
        max > maxListItems ||
        min > max
      ) {
        return refuse(
          problem,
          at,
          `"minItems" and "maxItems" are whole numbers, 0 <= minItems <= maxItems <= ${maxListItems}`,
        );
      }
      const items = readField(declared.items, `${at}.items`, depth + 1, problem);
      if (items === null) return null;
      return { ...common, type: 'list', items, minItems: min, maxItems: max };
    }
    case 'object': {
      if (depth >= maxDepth)
        return refuse(problem, at, `lists and objects nest at most ${maxDepth} deep`);
      if (!isObject(declared.fields) || Object.keys(declared.fields).length === 0) {
        return refuse(problem, at, '"fields" is an object of one or more values');
      }
      const before = problem.count;
      const fields = readFields(declared.fields, `${at}.fields`, depth + 1, problem);
      if (fields === null || problem.count !== before) return null;
      return { ...common, type: 'object', fields };
    }
    default:
      return refuse(problem, at, '"type" is number, boolean, choice, text, list or object');
  }
}

function refuse(problem: Reporter, at: string, message: string): null {
  problem(`${at}: ${message}`);
  return null;
}

// Checks value against field, reporting each problem at its path. Reports whether it is valid.
function checkValue(
  field: ConfigField,
  value: unknown,
  at: string,
  languages: readonly GameLanguage[],
  rawProblem: (message: string) => void,
): boolean {
  let valid = true;
  const problem = (message: string) => {
    valid = false;
    rawProblem(message);
  };
  const walk = (field: ConfigField, value: unknown, at: string) => {
    switch (field.type) {
      case 'number':
        if (!isFiniteNumber(value)) return problem(`${at}: must be a number`);
        if (field.integer && !Number.isInteger(value))
          return problem(`${at}: must be a whole number`);
        if (field.min !== undefined && value < field.min)
          return problem(`${at}: must be at least ${field.min}`);
        if (field.max !== undefined && value > field.max)
          return problem(`${at}: must be at most ${field.max}`);
        return;
      case 'boolean':
        if (typeof value !== 'boolean') problem(`${at}: must be true or false`);
        return;
      case 'choice':
        if (typeof value !== 'string' || !field.options.includes(value)) {
          problem(
            `${at}: must be one of ${field.options.map((o) => JSON.stringify(o)).join(', ')}`,
          );
        }
        return;
      case 'text': {
        if (!field.translated) {
          if (typeof value !== 'string') return problem(`${at}: must be a text`);
          if (value.length > field.maxLength) {
            problem(`${at}: has ${value.length} characters; at most ${field.maxLength}`);
          }
          return;
        }
        if (!isObject(value)) {
          return problem(
            `${at}: is translated: an object with one text per language (${languages.join(', ')})`,
          );
        }
        for (const language of languages) {
          const text = value[language];
          if (typeof text !== 'string') problem(`${at}.${language}: must be a text`);
          else if (text.length > field.maxLength) {
            problem(`${at}.${language}: has ${text.length} characters; at most ${field.maxLength}`);
          }
        }
        for (const key of Object.keys(value)) {
          if (!(languages as readonly string[]).includes(key)) {
            problem(`${at}.${key}: is not one of the game's languages (${languages.join(', ')})`);
          }
        }
        return;
      }
      case 'list':
        if (!Array.isArray(value)) return problem(`${at}: must be a list`);
        if (value.length < field.minItems || value.length > field.maxItems) {
          problem(`${at}: has ${value.length} items; from ${field.minItems} to ${field.maxItems}`);
        }
        value.forEach((item, i) => walk(field.items, item, `${at}[${i}]`));
        return;
      case 'object':
        if (!isObject(value)) return problem(`${at}: must be an object`);
        for (const [key, inner] of Object.entries(field.fields)) {
          if (!(key in value)) problem(`${at}.${key}: is missing`);
          else walk(inner, value[key], `${at}.${key}`);
        }
        for (const key of Object.keys(value)) {
          if (!(key in field.fields)) problem(`${at}.${key}: is not declared`);
        }
        return;
    }
  };
  walk(field, value, at);
  return valid;
}

// The module `@playhoot/config` (withPrivate false) or `@playhoot/config/server` (true). typed
// says whether it is the type-checked TypeScript or the bundled JavaScript.
export function configModule(
  config: Config,
  languages: readonly GameLanguage[],
  withPrivate: boolean,
  typed: boolean,
): string {
  const schema = withPrivate ? config.schema : publicFields(config.schema);
  const values = valueOf(
    { type: 'object', fields: schema, description: '', private: false },
    config.values,
  );
  if (!typed) return `export const config = ${JSON.stringify(values)};\n`;
  return `export interface Config ${objectType(schema, languages)}\nexport const config: Config = ${JSON.stringify(values)};\n`;
}

function publicFields(fields: Record<string, ConfigField>): Record<string, ConfigField> {
  const kept: Record<string, ConfigField> = {};
  for (const [key, field] of Object.entries(fields)) {
    if (field.private) continue;
    kept[key] = publicField(field);
  }
  return kept;
}

function publicField(field: ConfigField): ConfigField {
  if (field.type === 'list') return { ...field, items: publicField(field.items) };
  if (field.type === 'object') return { ...field, fields: publicFields(field.fields) };
  return field;
}

// value with only what field declares (so private parts left out of field are dropped).
function valueOf(field: ConfigField, value: unknown): unknown {
  if (field.type === 'list') return (value as unknown[]).map((item) => valueOf(field.items, item));
  if (field.type === 'object') {
    const object = value as Record<string, unknown>;
    const kept: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(field.fields))
      kept[key] = valueOf(inner, object[key]);
    return kept;
  }
  return value;
}

function typeOf(field: ConfigField, languages: readonly GameLanguage[]): string {
  switch (field.type) {
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'choice':
      return field.options.map((option) => JSON.stringify(option)).join(' | ');
    case 'text':
      return field.translated
        ? `{ ${languages.map((language) => `readonly ${JSON.stringify(language)}: string;`).join(' ')} }`
        : 'string';
    case 'list':
      return `readonly (${typeOf(field.items, languages)})[]`;
    case 'object':
      return objectType(field.fields, languages);
  }
}

function objectType(
  fields: Record<string, ConfigField>,
  languages: readonly GameLanguage[],
): string {
  const members = Object.entries(fields).map(
    ([key, field]) => `readonly ${key}: ${typeOf(field, languages)};`,
  );
  return members.length === 0 ? '{}' : `{ ${members.join(' ')} }`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
