import type { GameContainer } from '@playhoot/game-host';

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

// WebGameHost's container (plan §10): a sandboxed iframe with `allow-scripts` only, so the game
// runs in an opaque origin with no access to this page, its storage or its cookies. The game's
// HTML is placed in `srcdoc` with the policy above as the first element of its head.
export function createIframeGameContainer(parent: HTMLElement, title: string): GameContainer {
  return {
    open(html, handlers) {
      const iframe = document.createElement('iframe');
      iframe.title = title;
      iframe.setAttribute('sandbox', 'allow-scripts');
      iframe.referrerPolicy = 'no-referrer';
      iframe.srcdoc = withContentSecurityPolicy(html);
      iframe.style.cssText = 'display:block;width:100%;height:100%;border:0';

      // Messages count only when they come from this iframe's window (its origin is "null").
      const onMessage = (event: MessageEvent) => {
        if (event.source !== null && event.source === iframe.contentWindow) {
          handlers.onMessage(event.data);
        }
      };
      // The first load is the artifact. Any later one means the game navigated its frame away.
      let loads = 0;
      const onLoad = () => {
        loads += 1;
        if (loads > 1) handlers.onViolation('the game navigated its frame');
      };
      window.addEventListener('message', onMessage);
      iframe.addEventListener('load', onLoad);
      parent.append(iframe);

      return {
        send(message) {
          // An opaque origin cannot be named; the target is this exact window.
          iframe.contentWindow?.postMessage(message, '*');
        },
        dispose() {
          window.removeEventListener('message', onMessage);
          iframe.removeEventListener('load', onLoad);
          iframe.remove();
        },
      };
    },
  };
}

// Parses the untrusted HTML as the browser will (comments, missing tags and all), so the policy
// really is the first thing in the head, ahead of anything the game wrote.
function withContentSecurityPolicy(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const meta = doc.createElement('meta');
  meta.httpEquiv = 'Content-Security-Policy';
  meta.content = gameContentSecurityPolicy;
  doc.head.prepend(meta);
  return '<!doctype html>\n' + doc.documentElement.outerHTML;
}
