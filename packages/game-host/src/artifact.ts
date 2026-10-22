import { err, ok, type Result } from '@playhoot/communication';

// Where a GameVersion's frontend artifact is, as the backend's `session_started` gives it: a signed
// URL (short-lived) and the SHA-256 of its content (lowercase hex).
export interface ArtifactRef {
  url: string;
  sha256: string;
}

export type ArtifactFailure =
  // Network error, CORS refusal, or an HTTP error status (an expired signed URL answers 4xx).
  | { kind: 'unreachable'; detail: string }
  // The bytes are not the ones the backend pinned for this GameVersion.
  | { kind: 'hash-mismatch' };

// Verified artifacts by hash. The signed URL expires after a few minutes but the hash never
// changes, so a reconnect or a refresh later in the game loads from here (BACKEND_CONTRACT G5).
export interface ArtifactCache {
  get(sha256: string): Promise<string | undefined>;
  put(sha256: string, html: string): Promise<void>;
}

// A verified artifact, and whether it came from the cache (no download).
export interface LoadedArtifact {
  html: string;
  cached: boolean;
}

export interface ArtifactLoader {
  // The artifact's HTML, verified against its hash. Never throws.
  load(ref: ArtifactRef): Promise<Result<LoadedArtifact, ArtifactFailure>>;
}

export interface ArtifactLoaderOptions {
  cache: ArtifactCache;
  fetch?: typeof fetch;
}

export function createArtifactLoader(options: ArtifactLoaderOptions): ArtifactLoader {
  const doFetch = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
  return {
    async load(ref) {
      const expected = ref.sha256.toLowerCase();
      const cached = await options.cache.get(expected).catch(() => undefined);
      // Cached content is checked again: browser storage is outside this code's control.
      if (
        cached !== undefined &&
        (await sha256Hex(new TextEncoder().encode(cached))) === expected
      ) {
        return ok({ html: cached, cached: true });
      }
      let bytes: Uint8Array;
      try {
        // The signed URL is the credential; nothing of the Host's (cookies) goes with it.
        const response = await doFetch(ref.url, { credentials: 'omit' });
        if (!response.ok) return err({ kind: 'unreachable', detail: `HTTP ${response.status}` });
        bytes = new Uint8Array(await response.arrayBuffer());
      } catch (error) {
        return err({ kind: 'unreachable', detail: String(error) });
      }
      if ((await sha256Hex(bytes)) !== expected) return err({ kind: 'hash-mismatch' });
      const html = new TextDecoder().decode(bytes);
      await options.cache.put(expected, html).catch(() => undefined);
      return ok({ html, cached: false });
    },
  };
}

export function createMemoryArtifactCache(): ArtifactCache {
  const entries = new Map<string, string>();
  return {
    get: (sha256) => Promise.resolve(entries.get(sha256)),
    put: (sha256, html) => {
      entries.set(sha256, html);
      return Promise.resolve();
    },
  };
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
