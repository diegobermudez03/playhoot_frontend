import {
  createMemoryArtifactCache,
  createMemoryAssetCache,
  type ArtifactCache,
  type AssetCache,
} from '@playhoot/game-host';

const cacheName = 'playhoot-game-artifacts-v1';
const keyFor = (sha256: string) => new Request(`/__playhoot/artifacts/${sha256}`);

// Verified game artifacts kept in the browser's Cache Storage, so a refresh or a reconnect after
// the signed URL expired (15 min) still loads the game (BACKEND_CONTRACT G5). Content is
// immutable by hash, so entries never go stale. Without Cache Storage (blocked, private modes,
// insecure origins) it keeps them for this page only.
export function createBrowserArtifactCache(): ArtifactCache {
  const memory = createMemoryArtifactCache();
  const open = () =>
    'caches' in globalThis ? globalThis.caches.open(cacheName) : Promise.reject(new Error());
  return {
    async get(sha256) {
      const inMemory = await memory.get(sha256);
      if (inMemory !== undefined) return inMemory;
      try {
        const response = await (await open()).match(keyFor(sha256));
        return response ? await response.text() : undefined;
      } catch {
        return undefined;
      }
    },
    async put(sha256, html) {
      await memory.put(sha256, html);
      try {
        await (
          await open()
        ).put(keyFor(sha256), new Response(html, { headers: { 'Content-Type': 'text/html' } }));
      } catch {
        // Memory still has it.
      }
    },
  };
}

const assetCacheName = 'playhoot-game-assets-v1';
const assetKeyFor = (sha256: string) => new Request(`/__playhoot/assets/${sha256}`);

// Verified game assets in Cache Storage (ADR-0008), by hash like the artifacts. Every read gives a
// fresh buffer, which the GameHost transfers to the game without another copy. Without Cache
// Storage it keeps them for this page only.
export function createBrowserAssetCache(): AssetCache {
  const memory = createMemoryAssetCache();
  let storage = true;
  const open = () =>
    storage && 'caches' in globalThis
      ? globalThis.caches.open(assetCacheName)
      : Promise.reject(new Error());
  return {
    async get(sha256) {
      try {
        const response = await (await open()).match(assetKeyFor(sha256));
        if (response) return await response.arrayBuffer();
      } catch {
        // Falls back to memory.
      }
      return memory.get(sha256);
    },
    async put(sha256, bytes) {
      try {
        await (await open()).put(assetKeyFor(sha256), new Response(bytes));
      } catch {
        storage = false;
        await memory.put(sha256, bytes);
      }
    },
  };
}
