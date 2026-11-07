import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';

import { describe, expect, it } from 'vitest';

import { build } from './build.ts';
import { configModule, loadConfig } from './config.ts';

const schema = {
  rounds: { type: 'number', description: 'Rounds', integer: true, min: 1, max: 10, default: 3 },
  hard: { type: 'boolean', description: 'Hard mode', default: false },
  mode: { type: 'choice', description: 'Mode', options: ['fast', 'slow'], default: 'fast' },
  title: { type: 'text', description: 'Title', maxLength: 20, translated: true },
  questions: {
    type: 'list',
    description: 'Questions',
    minItems: 1,
    maxItems: 3,
    items: {
      type: 'object',
      description: 'A question',
      fields: {
        text: { type: 'text', description: 'Text' },
        answer: { type: 'number', description: 'Right option', private: true },
      },
    },
  },
};

const values = (set: Record<string, unknown>) =>
  JSON.stringify({ format: 'playhoot.config.v1', values: set });

function load(declared: unknown, text: string | null) {
  const problems: { message: string; file: string | undefined }[] = [];
  const config = loadConfig(declared, text, ['es', 'en'], (message, file) =>
    problems.push({ message, file }),
  );
  return { config, problems };
}

describe('loadConfig', () => {
  it('takes the values from config.json and the defaults for the rest', () => {
    const { config, problems } = load(
      schema,
      values({
        rounds: 5,
        title: { es: 'Hola', en: 'Hi' },
        questions: [{ text: 'a', answer: 1 }],
      }),
    );
    expect(problems).toEqual([]);
    expect(config.values).toEqual({
      rounds: 5,
      hard: false,
      mode: 'fast',
      title: { es: 'Hola', en: 'Hi' },
      questions: [{ text: 'a', answer: 1 }],
    });
  });

  it('reports each wrong value at its path, on config.json', () => {
    const { problems } = load(
      schema,
      values({
        rounds: 2.5,
        mode: 'medium',
        title: { es: 'Hola', fr: 'Salut' },
        questions: [{ text: 'a' }, { text: 'b', answer: 1, extra: true }, {}, {}],
        speed: 3,
      }),
    );
    expect(problems.every((p) => p.file === 'config.json')).toBe(true);
    expect(problems.map((p) => p.message)).toEqual([
      'rounds: must be a whole number',
      'mode: must be one of "fast", "slow"',
      'title.en: must be a text',
      `title.fr: is not one of the game's languages (es, en)`,
      'questions: has 4 items; from 1 to 3',
      'questions[0].answer: is missing',
      'questions[1].extra: is not declared',
      'questions[2].text: is missing',
      'questions[2].answer: is missing',
      'questions[3].text: is missing',
      'questions[3].answer: is missing',
      '"speed" is not declared in game.project.json "config"',
    ]);
  });

  it('requires a value without default, and config.json in its format', () => {
    expect(load(schema, null).problems.map((p) => p.message)).toEqual([
      '"title" has no default in game.project.json, so config.json must set it',
      '"questions" has no default in game.project.json, so config.json must set it',
    ]);
    expect(load(schema, '{"values": {}}').problems.map((p) => p.message)).toEqual([
      'config.json is {"format": "playhoot.config.v1", "values": {...}}',
    ]);
    expect(load(undefined, values({ a: 1 })).problems.map((p) => p.message)).toEqual([
      '"a" is not declared in game.project.json "config" (it declares none)',
    ]);
  });

  it('reports a wrong declaration on game.project.json', () => {
    const { problems } = load(
      {
        'bad-key': { type: 'number', description: 'x' },
        noType: { description: 'x' },
        noDescription: { type: 'boolean' },
        badRange: { type: 'number', description: 'x', min: 5, max: 1 },
        badDefault: { type: 'number', description: 'x', max: 1, default: 2 },
        nestedDefault: {
          type: 'list',
          description: 'x',
          items: { type: 'number', description: 'y', default: 1 },
        },
        emptyChoice: { type: 'choice', description: 'x', options: [] },
      },
      null,
    );
    expect(problems.every((p) => p.file === 'game.project.json')).toBe(true);
    expect(problems.map((p) => p.message)).toEqual([
      'config.bad-key: keys start with a letter and hold up to 64 letters, digits or underscores',
      'config.noType: "type" is number, boolean, choice, text, list or object',
      'config.noDescription: "description" says what the value is, in 1 to 300 characters',
      'config.badRange: "min" is at most "max"',
      `config.nestedDefault.items: only top-level values have a "default"; a list's default holds its items`,
      'config.emptyChoice: "options" lists 1 to 50 different strings of 1 to 64 characters',
      'config.badDefault.default: must be at most 1',
    ]);
  });
});

describe('configModule', () => {
  const { config } = load(
    schema,
    values({ title: { es: 'Hola', en: 'Hi' }, questions: [{ text: 'a', answer: 1 }] }),
  );

  it('leaves private values out of @playhoot/config and keeps them for the server', () => {
    const run = (code: string) => {
      const context = vm.createContext({});
      vm.runInContext(code.replace('export const', 'var'), context);
      return vm.runInContext('config', context);
    };
    expect(run(configModule(config, ['es', 'en'], false, false)).questions).toEqual([
      { text: 'a' },
    ]);
    expect(run(configModule(config, ['es', 'en'], true, false)).questions).toEqual([
      { text: 'a', answer: 1 },
    ]);
  });

  it('types each value from its declaration', () => {
    const typed = configModule(config, ['es', 'en'], false, true);
    expect(typed).toContain(
      'export interface Config { readonly rounds: number; readonly hard: boolean; readonly mode: "fast" | "slow"; readonly title: { readonly "es": string; readonly "en": string; }; readonly questions: readonly ({ readonly text: string; })[]; }',
    );
  });
});

describe('build with configuration', { timeout: 60_000 }, () => {
  it('builds both modules, and keeps the private one out of client code', async () => {
    const root = await mkdtemp(join(tmpdir(), 'playhoot-game-'));
    try {
      await mkdir(join(root, 'server'));
      await mkdir(join(root, 'client'));
      await writeFile(
        join(root, 'game.project.json'),
        JSON.stringify({
          format: 'playhoot.project.v1',
          languages: ['en'],
          config: {
            seconds: { type: 'number', description: 'Seconds', default: 10 },
            secret: { type: 'text', description: 'Secret', default: 'x', private: true },
          },
        }),
      );
      await writeFile(join(root, 'config.json'), values({ seconds: 15, secret: 'hidden-word' }));
      await writeFile(
        join(root, 'server/game.ts'),
        `import { config } from '@playhoot/config/server';
import { defineGame } from '@playhoot/game-server';
export default defineGame({
  players: { min: 1, max: 2 },
  setup: () => ({ secret: config.secret }),
  phases: { play: { seconds: config.seconds } },
  view: () => ({}),
});
`,
      );
      const client = (from: string, read: string) =>
        `import { config } from '${from}';\nexport default function Game() { return String(config.${read}); }\n`;

      await writeFile(join(root, 'client/Game.tsx'), client('@playhoot/config', 'seconds'));
      const built = await build(root);
      if (!built.ok) throw new Error(JSON.stringify(built.diagnostics));
      expect(built.server).toContain('hidden-word');
      expect(built.client).not.toContain('hidden-word');

      // A private value is not in the client's type, and the server module is not available.
      await writeFile(join(root, 'client/Game.tsx'), client('@playhoot/config', 'secret'));
      const untyped = await build(root);
      expect(untyped.ok).toBe(false);
      if (untyped.ok) return;
      expect(untyped.diagnostics).toEqual([
        expect.objectContaining({ stage: 'types', file: 'client/Game.tsx', line: 2 }),
      ]);
      await writeFile(join(root, 'client/Game.tsx'), client('@playhoot/config/server', 'secret'));
      const refused = await build(root);
      expect(refused.ok).toBe(false);
      if (refused.ok) return;
      expect(refused.diagnostics).toEqual([
        expect.objectContaining({
          stage: 'source',
          file: 'client/Game.tsx',
          message: expect.stringContaining('"@playhoot/config/server" is not available in client/'),
        }),
      ]);

      // A wrong value fails the build on config.json.
      await writeFile(join(root, 'config.json'), values({ seconds: 'fast' }));
      const wrong = await build(root);
      expect(wrong.ok).toBe(false);
      if (wrong.ok) return;
      expect(wrong.diagnostics).toEqual([
        { stage: 'project', file: 'config.json', message: 'seconds: must be a number' },
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
