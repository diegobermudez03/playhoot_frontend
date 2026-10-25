import { bridgeMarker, bridgeRates, type GameToHostMessage } from '@playhoot/protocol/bridge';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createPlayhoot, detectTransport } from './index';

// Tests run in Node: the page's `window` and `document` are plain event targets.
function stubPage(channel?: { postMessage(message: string): void }) {
  const window = new EventTarget();
  const document = new EventTarget();
  vi.stubGlobal('window', window);
  vi.stubGlobal('document', document);
  if (channel) vi.stubGlobal('ReactNativeWebView', channel);
  const deliver = (target: EventTarget, data: unknown) =>
    target.dispatchEvent(new MessageEvent('message', { data }));
  return { window, document, deliver };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// A Host that answers through `answer`, recording what the game posted.
function fakeHost() {
  const posted: GameToHostMessage[] = [];
  let toGame: ((message: unknown) => void) | null = null;
  const playhoot = createPlayhoot({
    post: (message) => posted.push(message),
    listen(handler) {
      toGame = handler;
      return () => (toGame = null);
    },
  });
  const answer = (message: Record<string, unknown>) =>
    toGame?.({ bridge: bridgeMarker, ...message });
  const start = () =>
    answer({
      type: 'start',
      version: 1,
      context: { participantId: 'P1', participants: ['P1'], locale: 'es' },
      projection: null,
    });
  const assetRequests = () =>
    posted.filter(
      (message): message is Extract<GameToHostMessage, { type: 'request_asset' }> =>
        message.type === 'request_asset',
    );
  return { playhoot, posted, answer, start, assetRequests };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('assets', () => {
  it('declares assets once, with identifier-like keys and known types', () => {
    const host = fakeHost();
    expect(() => host.playhoot.assets({ 'bad-key': 'image' })).toThrow('invalid asset key');
    const other = fakeHost();
    expect(() => other.playhoot.assets({ ship: 'sprite' as never })).toThrow('unknown type');
    const third = fakeHost();
    const assets = third.playhoot.assets({ ship: 'image' });
    expect(assets.ship).toEqual({ key: 'ship', type: 'image' });
    expect(() => third.playhoot.assets({ boom: 'audio' })).toThrow('declares every asset once');
  });

  it('loads only declared handles, waiting for the Host, and refuses a wrong type', async () => {
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:local' });
    const host = fakeHost();
    const assets = host.playhoot.assets({ ship: 'image', thrust: 'audio' });
    const ship = host.playhoot.load(assets.ship);
    const thrust = host.playhoot.load(assets.thrust);
    await expect(host.playhoot.load({ key: 'ship', type: 'image' })).rejects.toThrow(
      'takes a handle returned by assets()',
    );
    // Nothing goes out before the Host started the game.
    expect(host.assetRequests()).toEqual([]);

    void host.playhoot.ready();
    host.start();
    const [shipRequest, thrustRequest] = host.assetRequests();
    expect([shipRequest?.key, thrustRequest?.key]).toEqual(['ship', 'thrust']);
    const bytes = new ArrayBuffer(1);
    host.answer({
      type: 'asset',
      id: shipRequest?.id,
      key: 'ship',
      found: true,
      mimeType: 'image/png',
      bytes,
    });
    host.answer({
      type: 'asset',
      id: thrustRequest?.id,
      key: 'thrust',
      found: true,
      mimeType: 'image/png',
      bytes,
    });
    await expect(ship).resolves.toBe('blob:local');
    await expect(thrust).rejects.toThrow('is not an audio');
    // A loaded asset is not asked again.
    await expect(host.playhoot.load(assets.ship)).resolves.toBe('blob:local');
    expect(host.assetRequests()).toHaveLength(2);
  });

  it('keeps at most the Host pending cap in flight while preloading many', async () => {
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:local' });
    const host = fakeHost();
    const declaration = Object.fromEntries(
      Array.from({ length: 12 }, (_, i) => [`a${i}`, 'image' as const]),
    );
    const assets = host.playhoot.assets(declaration);
    void host.playhoot.ready();
    host.start();
    const preloading = host.playhoot.preload(Object.values(assets));
    expect(host.assetRequests()).toHaveLength(bridgeRates.maxPendingAssets);

    for (const request of host.assetRequests()) {
      host.answer({
        type: 'asset',
        id: request.id,
        key: request.key,
        found: true,
        mimeType: 'image/webp',
        bytes: new ArrayBuffer(1),
      });
    }
    await flush();
    const requests = host.assetRequests();
    expect(requests).toHaveLength(12);
    for (const request of requests.slice(bridgeRates.maxPendingAssets)) {
      host.answer({
        type: 'asset',
        id: request.id,
        key: request.key,
        found: true,
        mimeType: 'image/webp',
        bytes: new ArrayBuffer(1),
      });
    }
    await expect(preloading).resolves.toBeUndefined();
  });
});

describe('detectTransport', () => {
  it('uses the WebView channel when there is one, sending JSON text', async () => {
    const sent: string[] = [];
    const page = stubPage({ postMessage: (message) => sent.push(message) });
    const playhoot = createPlayhoot();

    const started = playhoot.ready();
    expect(sent.map((message) => JSON.parse(message) as unknown)).toEqual([
      { bridge: bridgeMarker, type: 'ready', versions: [1] },
    ]);

    // Android dispatches on `document`; anything that is not JSON text is ignored.
    page.deliver(page.document, '{not json');
    page.deliver(page.document, { bridge: bridgeMarker, type: 'start' });
    page.deliver(
      page.document,
      JSON.stringify({
        bridge: bridgeMarker,
        type: 'start',
        version: 1,
        context: { participantId: 'P1', participants: ['P1'], locale: 'es' },
        projection: null,
      }),
    );
    await expect(started).resolves.toEqual({
      participantId: 'P1',
      participants: ['P1'],
      locale: 'es',
    });

    playhoot.sample({ boost: true });
    expect(JSON.parse(sent[1] ?? '')).toEqual({
      bridge: bridgeMarker,
      type: 'sample',
      id: 1,
      inputs: { boost: true },
    });
  });

  it('listens on window too, and stops listening when asked', () => {
    const page = stubPage({ postMessage: () => undefined });
    const received: unknown[] = [];
    const stop = detectTransport().listen((message) => received.push(message));

    page.deliver(page.window, JSON.stringify({ n: 1 }));
    stop();
    page.deliver(page.window, JSON.stringify({ n: 2 }));
    page.deliver(page.document, JSON.stringify({ n: 3 }));
    expect(received).toEqual([{ n: 1 }]);
  });

  it('falls back to the parent window without a WebView channel', () => {
    const page = stubPage();
    const posted: unknown[] = [];
    Object.assign(page.window, {
      parent: { postMessage: (message: unknown) => posted.push(message) },
    });

    detectTransport().post({ bridge: bridgeMarker, type: 'ready', versions: [1] });
    expect(posted).toEqual([{ bridge: bridgeMarker, type: 'ready', versions: [1] }]);
  });
});
