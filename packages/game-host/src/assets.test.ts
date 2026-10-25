import { describe, expect, it } from 'vitest';

import { sha256Hex } from './artifact';
import { createAssetLoader, createMemoryAssetCache, type GameAssetRef } from './assets';

const png = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);

async function ref(overrides: Partial<GameAssetRef> = {}): Promise<GameAssetRef> {
  return {
    key: 'ship',
    type: 'image',
    mimeType: 'image/png',
    sha256: await sha256Hex(png),
    size: png.byteLength,
    url: 'https://storage.example/ship?signature',
    ...overrides,
  };
}

function setup(body: () => Response = () => new Response(png.slice())) {
  const requests: { url: string; credentials: RequestCredentials | undefined }[] = [];
  const cache = createMemoryAssetCache();
  const loader = createAssetLoader({
    cache,
    fetch: (input, init) => {
      requests.push({ url: String(input), credentials: init?.credentials });
      return Promise.resolve(body());
    },
  });
  return { loader, cache, requests };
}

describe('createAssetLoader', () => {
  it('downloads a listed asset without credentials, verified, then serves it from the cache', async () => {
    const t = setup();
    const assets = t.loader.resolverFor([await ref()]);

    const first = await assets.resolve('ship');
    expect(first?.mimeType).toBe('image/png');
    expect(new Uint8Array(first?.bytes ?? new ArrayBuffer(0))).toEqual(png);
    const second = await assets.resolve('ship');
    expect(new Uint8Array(second?.bytes ?? new ArrayBuffer(0))).toEqual(png);
    expect(t.requests).toEqual([
      { url: 'https://storage.example/ship?signature', credentials: 'omit' },
    ]);
    // Each answer is its own buffer, so transferring one never empties the cache.
    expect(first?.bytes).not.toBe(second?.bytes);
  });

  it('downloads once for requests made at the same time', async () => {
    const t = setup();
    const assets = t.loader.resolverFor([await ref()]);
    const answers = await Promise.all([assets.resolve('ship'), assets.resolve('ship')]);
    expect(answers.every((answer) => answer !== null)).toBe(true);
    expect(t.requests).toHaveLength(1);
  });

  it('serves only the keys the backend listed', async () => {
    const t = setup();
    expect(await t.loader.resolverFor([await ref()]).resolve('dragon')).toBeNull();
    expect(t.requests).toHaveLength(0);
  });

  it('refuses bytes that do not match the pinned size or hash, and tries again later', async () => {
    let body = new Uint8Array([1, 2, 3]);
    const t = setup(() => new Response(body.slice()));
    const assets = t.loader.resolverFor([await ref()]);
    expect(await assets.resolve('ship')).toBeNull();

    body = new Uint8Array(png.byteLength);
    expect(await assets.resolve('ship')).toBeNull();

    body = png;
    expect(await assets.resolve('ship')).not.toBeNull();
    expect(t.requests).toHaveLength(3);
  });

  it('answers no asset when the download fails', async () => {
    const t = setup(() => new Response('', { status: 403 }));
    expect(await t.loader.resolverFor([await ref()]).resolve('ship')).toBeNull();
  });

  it('checks cached bytes again', async () => {
    const t = setup();
    const asset = await ref();
    await t.cache.put(asset.sha256, new Uint8Array([9, 9]).buffer);
    const answer = await t.loader.resolverFor([asset]).resolve('ship');
    expect(new Uint8Array(answer?.bytes ?? new ArrayBuffer(0))).toEqual(png);
    expect(t.requests).toHaveLength(1);
  });
});
