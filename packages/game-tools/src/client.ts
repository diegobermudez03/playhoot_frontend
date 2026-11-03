// Builds the game's frontend: ONE self-contained HTML file with the game, React and the Game SDK
// inline, the only frontend shape the backend stores (docs/architecture/BACKEND_CONTRACT.md G6).
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { rolldown, type Plugin } from 'rolldown';

import { clientEntry, type Project } from './project.ts';

const entryId = '\0playhoot-client-entry';
const toolchainFile = fileURLToPath(import.meta.url);

export async function buildClient(project: Project): Promise<string> {
  const bundle = await rolldown({
    input: entryId,
    platform: 'browser',
    logLevel: 'silent',
    plugins: [entryPlugin(project)],
    transform: {
      jsx: 'react-jsx',
      define: { 'process.env.NODE_ENV': '"production"' },
    },
  });
  const { output } = await bundle.generate({ format: 'iife', minify: true });
  await bundle.close();
  // `</script` inside the code would end the inline script early.
  const code = output[0].code.replace(/<\/script/gi, '<\\/script');
  return [
    '<!doctype html>',
    '<html>',
    '<head>',
    '<meta charset="utf-8">',
    '<title>Playhoot game</title>',
    '<style>html,body,#root{margin:0;width:100%;height:100%;overflow:hidden}</style>',
    '</head>',
    '<body>',
    '<div id="root"></div>',
    `<script>${code}</script>`,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

function entryPlugin(project: Project): Plugin {
  const gameFile = join(project.root, clientEntry).split('\\').join('/');
  return {
    name: 'playhoot-client-entry',
    async resolveId(source, importer) {
      if (source === entryId) return entryId;
      // SDK packages and React resolve from the toolchain, wherever the project lives.
      if (!source.startsWith('.') && !source.startsWith('\0') && importer !== undefined) {
        return this.resolve(source, toolchainFile, { skipSelf: true });
      }
      return null;
    },
    load(id) {
      if (id !== entryId) return null;
      return [
        `import Game from ${JSON.stringify(gameFile)};`,
        `import { mountGame } from '@playhoot/game-react';`,
        `void mountGame(Game);`,
      ].join('\n');
    },
  };
}
