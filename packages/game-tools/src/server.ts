// Builds the backend script: one flat classic script in the shape of the backend's scriptcheck
// profile `sdk-v1`, with the sandbox's global entrypoints generated around the game's definition.
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import { parse, type Node, type Program } from 'acorn';
import { rolldown, type Plugin } from 'rolldown';

import { reservedNames } from './check.ts';
import { configModule } from './config.ts';
import { serverEntry, type Diagnostic, type Project } from './project.ts';

const entryId = '\0playhoot-server-entry';
const configId = '\0playhoot-config';
const serverConfigId = '\0playhoot-config-server';
const toolchainFile = fileURLToPath(import.meta.url);

const adapterFunctions = [
  '__playhoot_start',
  '__playhoot_command',
  '__playhoot_samples',
  '__playhoot_update',
  '__playhoot_player_disconnected',
  '__playhoot_player_rejoined',
  '__playhoot_project',
  '__playhoot_manifest_of',
] as const;

export interface ServerBuild {
  script: string;
  manifest: unknown;
}

export async function buildServer(project: Project): Promise<ServerBuild> {
  const bundle = await rolldown({
    input: entryId,
    platform: 'neutral',
    logLevel: 'silent',
    plugins: [entryPlugin(project)],
  });
  const { output } = await bundle.generate({ format: 'esm', minify: false });
  await bundle.close();
  const code = output[0].code;
  const script = shapeScript(code);
  return { script, manifest: readManifest(script) };
}

// The entry exports the game's definition and the adapter, so nothing is tree-shaken away and the
// final export statement names each one's local binding.
function entryPlugin(project: Project): Plugin {
  const gameFile = join(project.root, serverEntry).split('\\').join('/');
  return {
    name: 'playhoot-server-entry',
    async resolveId(source, importer) {
      if (source === entryId) return entryId;
      if (source === '@playhoot/config') return configId;
      if (source === '@playhoot/config/server') return serverConfigId;
      // SDK packages resolve from the toolchain, wherever the project lives.
      if (!source.startsWith('.') && !source.startsWith('\0') && importer !== undefined) {
        return this.resolve(source, toolchainFile, { skipSelf: true });
      }
      return null;
    },
    load(id) {
      if (id === configId) return configModule(project.config, project.languages, false, false);
      if (id === serverConfigId) {
        return configModule(project.config, project.languages, true, false);
      }
      if (id !== entryId) return null;
      return [
        `import game from ${JSON.stringify(gameFile)};`,
        `export { game as __playhoot_game };`,
        `export { ${adapterFunctions.join(', ')} } from '@playhoot/game-server/runtime';`,
      ].join('\n');
    },
  };
}

// Turns the bundler's ESM output into the classic script the sandbox loads: the export statement
// removed, the definition bound by a const, the entrypoints and the list of top-level values to
// freeze generated.
export function shapeScript(code: string): string {
  const program = parse(code, { ecmaVersion: 'latest', sourceType: 'module' }) as Program;
  const last = program.body.at(-1);
  if (last?.type !== 'ExportNamedDeclaration' || last.source || last.declaration) {
    throw new Error('the bundle does not end with its export statement');
  }
  const locals = new Map<string, string>();
  for (const specifier of last.specifiers) {
    locals.set(nameOf(specifier.exported), nameOf(specifier.local));
  }
  const local = (exported: string) => {
    const name = locals.get(exported);
    if (name === undefined) throw new Error(`the bundle does not export ${exported}`);
    return name;
  };

  const topLevel = new Set<string>();
  const frozen: string[] = [];
  let definitionVar: Node | null = null;
  for (const statement of program.body) {
    if (statement.type === 'FunctionDeclaration' && statement.id) topLevel.add(statement.id.name);
    if (statement.type !== 'VariableDeclaration') continue;
    for (const declarator of statement.declarations) {
      if (declarator.id.type !== 'Identifier') continue;
      const name = declarator.id.name;
      topLevel.add(name);
      // `export default` comes out as a var; it is bound once, so it is a const.
      if (statement.kind === 'var' && name === local('__playhoot_game')) definitionVar = statement;
      if (declarator.init && !isPrimitive(declarator.init)) frozen.push(name);
    }
  }
  for (const name of [...reservedNames, '__playhoot_manifest', '__playhoot_module_values']) {
    if (topLevel.has(name)) throw new Error(`the bundle declares the reserved name ${name}`);
  }

  let body = code.slice(0, last.start) + code.slice(last.end);
  if (definitionVar !== null) {
    const start = (definitionVar as Node).start;
    body = body.slice(0, start) + 'const' + body.slice(start + 'var'.length);
  }

  const game = local('__playhoot_game');
  const call = (adapter: (typeof adapterFunctions)[number], args: string) =>
    `return ${local(adapter)}(${game}${args ? `, ${args}` : ''});`;
  const glue = [
    `function start(participants, context) { ${call('__playhoot_start', 'participants')} }`,
    `function command(state, cmd, context) { ${call('__playhoot_command', 'state, cmd, context')} }`,
    `function samples(state, transitions, context) { ${call('__playhoot_samples', 'state, transitions, context')} }`,
    `function update(state, context) { ${call('__playhoot_update', 'state, context')} }`,
    `function playerDisconnected(state, participant, context) { ${call('__playhoot_player_disconnected', 'state, participant, context')} }`,
    `function playerRejoined(state, participant, context) { ${call('__playhoot_player_rejoined', 'state, participant, context')} }`,
    `function project(state, participant, context) { ${call('__playhoot_project', 'state, participant, context')} }`,
    `function __playhoot_manifest() { ${call('__playhoot_manifest_of', '')} }`,
    `function __playhoot_module_values() { return [${frozen.join(', ')}]; }`,
  ];
  return `"use strict";\n${body.trimEnd()}\n\n//#region generated by @playhoot/game-tools\n${glue.join('\n')}\n//#endregion\n`;
}

function nameOf(node: Node): string {
  if (node.type === 'Identifier') return (node as Node & { name: string }).name;
  return String((node as Node & { value: unknown }).value);
}

function isPrimitive(node: Node): boolean {
  if (node.type === 'Literal') {
    const value = (node as Node & { value: unknown; regex?: unknown }).value;
    return !(node as { regex?: unknown }).regex && (value === null || typeof value !== 'object');
  }
  if (node.type === 'TemplateLiteral') {
    return (node as Node & { expressions: unknown[] }).expressions.length === 0;
  }
  if (node.type === 'UnaryExpression') {
    const unary = node as Node & { operator: string; argument: Node };
    return (unary.operator === '-' || unary.operator === '+') && unary.argument.type === 'Literal';
  }
  return false;
}

// Runs the finished script once to read the manifest its definition declares.
function readManifest(script: string): unknown {
  const context = vm.createContext({});
  vm.runInContext(script, context, { filename: 'server.js', timeout: 2000 });
  const manifest = vm.runInContext('JSON.stringify(__playhoot_manifest())', context, {
    timeout: 2000,
  });
  return JSON.parse(manifest as string);
}

// Starts the game with its minimum players and projects each view, so an error that would abort the
// first real Session is reported now.
export function smokeTest(script: string, players: number): Diagnostic[] {
  const participants = Array.from({ length: players }, (_, i) => `P${i + 1}`);
  const context = vm.createContext({ participants });
  try {
    vm.runInContext(script, context, { filename: 'server.js', timeout: 2000 });
    vm.runInContext(
      `{
        const context = { sessionTime: 0, elapsed: 0 };
        const started = start(participants, context);
        JSON.stringify(started);
        for (const participant of participants) JSON.stringify(project(started.state, participant, context));
      }`,
      context,
      { timeout: 2000 },
    );
    return [];
  } catch (error) {
    return [
      {
        stage: 'runtime',
        file: serverEntry,
        message: `starting the game failed: ${(error as Error).message}`,
      },
    ];
  }
}
