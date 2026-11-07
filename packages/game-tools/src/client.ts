// Builds the game's frontend: ONE self-contained HTML file with the game, React and the Game SDK
// inline, the only frontend shape the backend stores (docs/architecture/BACKEND_CONTRACT.md G6).
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { rolldown, type Plugin } from 'rolldown';

import { configModule } from './config.ts';
import { assetsModule, clientEntry, projectModule, type Project } from './project.ts';

const entryId = '\0playhoot-client-entry';
const assetsId = '\0playhoot-assets';
const projectId = '\0playhoot-project';
const configId = '\0playhoot-config';
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
      if (source === '@playhoot/assets') return assetsId;
      if (source === '@playhoot/project') return projectId;
      if (source === '@playhoot/config') return configId;
      // SDK packages and React resolve from the toolchain, wherever the project lives.
      if (!source.startsWith('.') && !source.startsWith('\0') && importer !== undefined) {
        return this.resolve(source, toolchainFile, { skipSelf: true });
      }
      return null;
    },
    load(id) {
      if (id === assetsId) return assetsModule(project, false);
      if (id === projectId) return projectModule(project, false);
      if (id === configId) return configModule(project.config, project.languages, false, false);
      if (id !== entryId) return null;
      return [
        `import Game from ${JSON.stringify(gameFile)};`,
        `import { assets } from '@playhoot/assets';`,
        `import { languages } from '@playhoot/project';`,
        `import { mountGame } from '@playhoot/game-react';`,
        `void mountGame(Game, { assets, languages });`,
      ].join('\n');
    },
  };
}
