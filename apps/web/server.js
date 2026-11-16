// The deployable unit of the web host (D-019): a small Node server that answers every public
// route with rendered HTML and serves the built files. It is written here rather than taken from
// `react-router-serve` for two reasons: nothing may log a request URL (a sign-in's one-time code
// travels in one, backend IDENTITY-ADR-0003 point 8), and `/es` must answer the page itself
// instead of redirecting to `/es/`, which is not the address its canonical link names.
import { createRequestHandler } from '@react-router/express';
import compression from 'compression';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';

const clientDirectory = path.resolve('build/client');
const build = await import('./build/server/index.js');

const port = Number(process.env.PORT ?? 3000);
const app = express();

app.disable('x-powered-by');
app.use(compression());

// Files whose name carries their content hash never change; everything else (icons, the manifest,
// the SDK guide) may be replaced by a deployment.
app.use(
  express.static(clientDirectory, {
    index: false,
    redirect: false,
    maxAge: '1h',
    setHeaders(response, filePath) {
      if (/-[A-Za-z0-9_-]{8,}\.[a-z0-9]+$/.test(path.basename(filePath))) {
        response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }),
);

// Public pages written out at build time. `/es` answers with `/es/index.html` as it is, with no
// redirect to a second address for the same page.
app.use((request, response, next) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') return next();
  const file = path.join(clientDirectory, request.path, 'index.html');
  if (!file.startsWith(clientDirectory) || !fs.existsSync(file)) return next();
  response.setHeader('Cache-Control', 'public, max-age=300');
  response.sendFile(file);
});

app.use(createRequestHandler({ build, mode: process.env.NODE_ENV }));

app.listen(port, () => {
  console.log(`Playhoot web host listening on port ${port}`);
});
