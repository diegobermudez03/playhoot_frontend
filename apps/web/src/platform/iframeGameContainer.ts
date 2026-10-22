import { fitGameViewport, type GameContainer, type GameViewport } from '@playhoot/game-host';

// What the game document may do (plan §16): run its own inline/blob scripts and styles, and use
// images, media and fonts it was handed as blob/data URLs (assets come through the Host). No
// network at all: no fetch/WebSocket, no external images, no forms, no base URL games.
export const gameContentSecurityPolicy = [
  "default-src 'none'",
  "script-src 'unsafe-inline' blob:",
  "style-src 'unsafe-inline' blob:",
  'img-src blob: data:',
  'media-src blob: data:',
  'font-src blob: data:',
  "connect-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

// What the game must not have, though CSP cannot take it away (ADR-0006): WebRTC reaches any host
// (STUN/TURN) whatever `connect-src` says, and a nested frame is a fresh window with WebRTC again.
// Removed from the game's HTML before it runs, and blocked while it runs by `gameGuardScript`.
const nestedFrameSelector = 'iframe, frame, frameset, object, embed, portal, fencedframe';
const declarativeShadowSelector = 'template[shadowrootmode], template[shadowroot]';

// Marks the guard's messages to the Host. The game could forge one, which only stops itself.
const guardMarker = 'playhoot.guard';

// Runs in the game's document before any of the game's scripts. Best effort (ADR-0006): it raises
// the cost of leaking the player's view far above what a generated game would do by accident, and
// any frame the game tries to create stops it as a container violation.
const gameGuardScript = `(() => {
  const host = window.parent;
  const report = (what) => host.postMessage({ '${guardMarker}': true, violation: what }, '*');
  for (const name of Object.getOwnPropertyNames(window)) {
    if (/^(webkit)?RTC/.test(name)) { try { delete window[name]; } catch (e) {} }
  }
  try { delete Document.parseHTMLUnsafe; } catch (e) {}
  for (const proto of [Element.prototype, ShadowRoot.prototype]) {
    try { delete proto.setHTMLUnsafe; } catch (e) {}
  }
  const frames = ${JSON.stringify(nestedFrameSelector)};
  const sweep = (node) => {
    if (!(node instanceof Element)) return;
    const found = node.matches(frames) ? [node] : [...node.querySelectorAll(frames)];
    for (const frame of found) { frame.remove(); report('nested ' + frame.localName); }
  };
  const observe = (root) => new MutationObserver((records) => {
    for (const record of records) record.addedNodes.forEach(sweep);
  }).observe(root, { childList: true, subtree: true });
  observe(document);
  const attachShadow = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (init) {
    const root = attachShadow.call(this, init);
    observe(root);
    return root;
  };
})();`;

// WebGameHost's container (plan §10): a sandboxed iframe with `allow-scripts` only, so the game
// runs in an opaque origin with no access to this page, its storage or its cookies. The game's
// HTML is placed in `srcdoc` with the policy above as the first element of its head, then the
// guard. The page itself forbids frames to navigate anywhere (`frame-src 'none'` in index.html),
// so the game cannot carry data away in its frame's URL either.
//
// The fixed-aspect viewport (plan §8): the iframe is always the game's logical size (e.g. 1920 x
// 1080 CSS pixels) and is scaled to fit `parent`, centered, with bars where space is left. Inside,
// the game always sees the same size, and the browser maps touches and clicks through the scale,
// so they arrive in logical units. A resize or rotation changes only the scale.
export function createIframeGameContainer(parent: HTMLElement, title: string): GameContainer {
  return {
    open(html, viewport, handlers) {
      const stage = document.createElement('div');
      stage.style.cssText = 'position:relative;width:100%;height:100%;overflow:hidden';
      const iframe = document.createElement('iframe');
      iframe.title = title;
      iframe.setAttribute('sandbox', 'allow-scripts');
      iframe.referrerPolicy = 'no-referrer';
      iframe.srcdoc = prepareGameDocument(html);
      iframe.style.cssText =
        `position:absolute;left:0;top:0;width:${viewport.width}px;height:${viewport.height}px;` +
        'border:0;transform-origin:0 0';
      const place = () => placeIframe(iframe, stage, viewport);
      const resizes = new ResizeObserver(place);

      // Messages count only when they come from this iframe's window (its origin is "null").
      const onMessage = (event: MessageEvent) => {
        if (event.source === null || event.source !== iframe.contentWindow) return;
        const data: unknown = event.data;
        if (typeof data === 'object' && data !== null && guardMarker in data) {
          const violation = (data as { violation?: unknown }).violation;
          handlers.onViolation(`the game tried to open a frame (${String(violation)})`);
          return;
        }
        handlers.onMessage(data);
      };
      // The first load is the artifact. Any later one means the game navigated its frame away.
      let loads = 0;
      const onLoad = () => {
        loads += 1;
        if (loads > 1) handlers.onViolation('the game navigated its frame');
      };
      window.addEventListener('message', onMessage);
      iframe.addEventListener('load', onLoad);
      stage.append(iframe);
      parent.append(stage);
      place();
      resizes.observe(stage);

      return {
        send(message) {
          // An opaque origin cannot be named; the target is this exact window.
          iframe.contentWindow?.postMessage(message, '*');
        },
        dispose() {
          resizes.disconnect();
          window.removeEventListener('message', onMessage);
          iframe.removeEventListener('load', onLoad);
          stage.remove();
        },
      };
    },
  };
}

// Parses the untrusted HTML as the browser will (comments, missing tags and all), so the policy
// and the guard really are the first things in the head, ahead of anything the game wrote, and no
// nested frame or declarative shadow root of the game's own HTML survives.
function prepareGameDocument(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc
    .querySelectorAll(`${nestedFrameSelector}, ${declarativeShadowSelector}`)
    .forEach((element) => element.remove());
  const meta = doc.createElement('meta');
  meta.httpEquiv = 'Content-Security-Policy';
  meta.content = gameContentSecurityPolicy;
  const guard = doc.createElement('script');
  guard.textContent = gameGuardScript;
  doc.head.prepend(meta, guard);
  return '<!doctype html>\n' + doc.documentElement.outerHTML;
}

function placeIframe(iframe: HTMLIFrameElement, stage: HTMLElement, viewport: GameViewport) {
  const fit = fitGameViewport({ width: stage.clientWidth, height: stage.clientHeight }, viewport);
  iframe.style.transform = `translate(${fit.left}px, ${fit.top}px) scale(${fit.scale})`;
}
