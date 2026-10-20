// Runtime configuration of the web host. Empty API base URL means same origin: in development the
// Vite dev server proxies `/v1` (HTTP and WebSocket) to the local backend (see vite.config.ts).
export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
} as const;
