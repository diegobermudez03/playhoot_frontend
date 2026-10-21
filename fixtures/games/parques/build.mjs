// Builds Parqués into ONE self-contained HTML file, the only artifact shape the backend stores
// today (BACKEND_CONTRACT.md G6): the game and the Game SDK bundled into an inline script.
// Writes dist/index.html and dist/artifact.json ({ sha256, bytes }), which the web app's dev
// server serves at `/__fixtures/games/parques/`.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'vite';

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, 'dist');

const output = await build({
  configFile: false,
  root,
  logLevel: 'warn',
  build: {
    write: false,
    minify: true,
    lib: { entry: join(root, 'src/main.ts'), formats: ['iife'], name: 'parques' },
  },
});
const chunks = (Array.isArray(output) ? output : [output]).flatMap((result) => result.output);
const code = chunks.find((chunk) => chunk.type === 'chunk')?.code;
if (!code) throw new Error('the build produced no script');

const template = await readFile(join(root, 'index.html'), 'utf8');
// `</script` inside the code would end the inline script early.
const html = template.replace(
  '<!-- game -->',
  () => `<script>${code.replace(/<\/script/gi, '<\\/script')}</script>`,
);
const bytes = Buffer.from(html, 'utf8');

await mkdir(dist, { recursive: true });
await writeFile(join(dist, 'index.html'), bytes);
const artifact = { sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length };
await writeFile(join(dist, 'artifact.json'), JSON.stringify(artifact, null, 2) + '\n');
console.log(`parques: dist/index.html (${artifact.bytes} bytes, sha256 ${artifact.sha256})`);
