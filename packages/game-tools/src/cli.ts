#!/usr/bin/env -S node --experimental-strip-types
// playhoot-game build <project> [--out <dir>] [--json]
// Builds an authoring project into <project>/dist (or --out). With --json prints the result as one
// JSON document, for programs that run the build.
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { build, writeBuild } from './build.ts';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { out: { type: 'string' }, json: { type: 'boolean', default: false } },
});
const [command, target] = positionals;
if (command !== 'build' || target === undefined) {
  console.error('usage: playhoot-game build <project> [--out <dir>] [--json]');
  process.exit(2);
}

const root = resolve(target);
const result = await build(root);
if (result.ok) await writeBuild(result, values.out ? resolve(values.out) : join(root, 'dist'));

if (values.json) {
  console.log(JSON.stringify(result.ok ? { ok: true, record: result.record } : result));
} else if (result.ok) {
  const { server, client } = result.record;
  console.log(`built: server.js ${server.bytes} B, client.html ${client.bytes} B`);
} else {
  for (const d of result.diagnostics) {
    const where = d.file ? `${d.file}${d.line ? `:${d.line}:${d.column}` : ''}: ` : '';
    console.error(`${where}[${d.stage}] ${d.message}`);
  }
}
process.exit(result.ok ? 0 : 1);
