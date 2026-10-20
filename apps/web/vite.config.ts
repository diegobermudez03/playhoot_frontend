import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// In development the browser talks only to this dev server; `/v1` (REST and WebSocket) is proxied
// to the local backend. Same origin means the backend needs no CORS for REST, and because the
// Host header is kept (no changeOrigin) the backend's WebSocket origin check sees Origin == Host.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backend = env.PLAYHOOT_BACKEND_URL || 'http://localhost:8081';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: { '/v1': { target: backend, ws: true } },
    },
  };
});
