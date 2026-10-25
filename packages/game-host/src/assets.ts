import type { AssetResolver } from './gameHost';
import { sha256Hex } from './artifact';

// A GameVersion asset as the backend's `session_started.frontend.assets` lists it (ADR-0008): its
// logical key, what it is, and where to download it (a signed URL that outlives the Session).
export interface GameAssetRef {
  key: string;
  type: string;
  mimeType: string;
  sha256: string;
  size: number;
  url: string;
}

// Verified asset bytes by hash. Content is immutable by hash, so entries never go stale. `get`
// returns a buffer the caller owns (it is transferred to the game, which detaches it).
export interface AssetCache {
  get(sha256: string): Promise<ArrayBuffer | undefined>;
  put(sha256: string, bytes: ArrayBuffer): Promise<void>;
}

export interface AssetLoaderOptions {
  cache: AssetCache;
  fetch?: typeof fetch;
}

export interface AssetLoader {
  // Serves the assets of one GameVersion: only the keys the backend listed.
  resolverFor(assets: readonly GameAssetRef[]): AssetResolver;
}

// Downloads game assets for the Host (the game never touches the network): without credentials,
// checked against the size and SHA-256 the backend pinned, cached by hash. A download that fails
// or does not match answers "no such asset"; the next request tries again.
export function createAssetLoader(options: AssetLoaderOptions): AssetLoader {
  const doFetch = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
  // One download per hash at a time, however many requests ask for it.
  const downloads = new Map<string, Promise<boolean>>();

  const download = (asset: GameAssetRef, sha256: string): Promise<boolean> => {
    const running = downloads.get(sha256);
    if (running) return running;
    const next = (async () => {
      try {
        const response = await doFetch(asset.url, { credentials: 'omit' });
        if (!response.ok) return false;
        const bytes = await response.arrayBuffer();
        if (bytes.byteLength !== asset.size) return false;
        if ((await sha256Hex(new Uint8Array(bytes))) !== sha256) return false;
        await options.cache.put(sha256, bytes).catch(() => undefined);
        return true;
      } catch {
        return false;
      } finally {
        downloads.delete(sha256);
      }
    })();
    downloads.set(sha256, next);
    return next;
  };

  // Cached bytes are checked again: browser storage is outside this code's control.
  const cached = async (sha256: string): Promise<ArrayBuffer | undefined> => {
    const bytes = await options.cache.get(sha256).catch(() => undefined);
    if (bytes === undefined) return undefined;
    return (await sha256Hex(new Uint8Array(bytes))) === sha256 ? bytes : undefined;
  };

  return {
    resolverFor(assets) {
      const byKey = new Map(assets.map((asset) => [asset.key, asset]));
      return {
        async resolve(key) {
          const asset = byKey.get(key);
          if (!asset) return null;
          const sha256 = asset.sha256.toLowerCase();
          let bytes = await cached(sha256);
          if (bytes === undefined && (await download(asset, sha256))) bytes = await cached(sha256);
          return bytes === undefined ? null : { mimeType: asset.mimeType, bytes };
        },
      };
    },
  };
}

export function createMemoryAssetCache(): AssetCache {
  const entries = new Map<string, ArrayBuffer>();
  return {
    // A copy: the one handed out is transferred to the game.
    get: (sha256) => Promise.resolve(entries.get(sha256)?.slice(0)),
    put: (sha256, bytes) => {
      entries.set(sha256, bytes.slice(0));
      return Promise.resolve();
    },
  };
}
