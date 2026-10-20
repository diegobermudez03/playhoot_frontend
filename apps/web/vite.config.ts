import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

// In development the browser talks only to this dev server; `/v1` (REST and WebSocket) is proxied
// to the local backend. Same origin means the backend needs no CORS for REST, and because the
// Host header is kept (no changeOrigin) the backend's WebSocket origin check sees Origin == Host.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backend = env.PLAYHOOT_BACKEND_URL || 'http://localhost:8081';

  return {
    plugins: [react(), fixtureGames()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: { '/v1': { target: backend, ws: true } },
    },
  };
});

// Development only: serves built fixture game artifacts (`npm run fixtures`) at
// `/__fixtures/games/<game>/<file>` for the GameHost lab (`/dev/game-host`).
function fixtureGames(): Plugin {
  const root = new URL('../../fixtures/games/', import.meta.url);
  return {
    name: 'playhoot-fixture-games',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__fixtures/games/', (req, res, next) => {
        const match = /^\/([a-z0-9-]+)\/(index\.html|artifact\.json)$/.exec(req.url ?? '');
        if (!match) return next();
        const [, game, file] = match;
        readFile(fileURLToPath(new URL(`${game}/dist/${file}`, root)))
          .then((content) => {
            res.setHeader('Content-Type', file === 'index.html' ? 'text/html' : 'application/json');
            res.setHeader('Cache-Control', 'no-store');
            res.end(content);
          })
          .catch(() => {
            res.statusCode = 404;
            res.end();
          });
      });
    },
  };
}
