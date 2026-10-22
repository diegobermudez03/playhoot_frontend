import { bridgeMarker } from '@playhoot/protocol/bridge';
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
