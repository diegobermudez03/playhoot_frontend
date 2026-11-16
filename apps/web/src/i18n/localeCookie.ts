// The name of the cookie that mirrors the chosen language for the server (D-024).
//
// It lives in a module of its own, with no imports, because the build reads it too: `vite-pwa.ts`
// writes the offline page, which has to pick its language the same way, and the Vite config
// loader cannot load this workspace's TypeScript packages.
export const localeCookieName = 'playhoot_locale';
