// API exposed to the generated game frontend. Responsibility and boundaries: see ../README.md.
import {
  bridgeLimits,
  bridgeMarker,
  bridgeRates,
  bridgeVersions,
  gameAssetKeyPattern,
  gameAssetMimeTypes,
  gameAssetTypes,
  isBridgeMessage,
  type GameAssetType,
  type GameCommandOutcome,
  type GameContext,
  type GameToHostMessage,
  type HostToGameMessage,
  type Projection,
} from '@playhoot/protocol/bridge';

export type {
  GameAssetType,
  GameCommandOutcome,
  GameContext,
  Projection,
} from '@playhoot/protocol/bridge';

// One declared asset. Only `assets()` makes them: loading takes a handle, never a free string.
export interface AssetHandle<T extends GameAssetType = GameAssetType> {
  readonly key: string;
  readonly type: T;
}

export interface CommandResult {
  outcome: GameCommandOutcome;
  // What the game script answered, when `outcome` is `executed`.
  response?: unknown;
}

export interface GameUpdate {
  // Present when the player's state changed (or a new baseline arrived).
  projection?: Projection;
  // The game's last sample id the backend has consumed.
  ack: number;
  events: unknown[];
  errors: unknown[];
}

export interface Playhoot {
  // Tells the Host the game is listening. Resolves with who the player is; the first projection
  // (if the game already has state) reaches `onProjection` right after. Call it once, after
  // registering handlers.
  ready(): Promise<GameContext>;
  // Every projection: the player's whole current state (patches are already applied).
  onProjection(handler: (projection: Projection) => void): () => void;
  // Game events addressed to this player, each delivered once.
  onEvent(handler: (event: unknown) => void): () => void;
  // Logical errors the game script raised for this player, each delivered once.
  onError(handler: (error: unknown) => void): () => void;
  // Every update, for games that want projection, ack and transients together.
  onUpdate(handler: (update: GameUpdate) => void): () => void;
  // Sends the full snapshot of the player's logical inputs; returns its sample id. Call it as
  // often as the inputs change: the Host sends only what the backend accepts and loses nothing.
  sample(inputs: Record<string, unknown>): number;
  command(name: string, payload?: Record<string, unknown> | null): Promise<CommandResult>;
  // Declares every asset the game uses, once, at the top of the script (ADR-0008): logical key to
  // `image` (sprites included), `audio` or `video`. Returns a handle per key.
  assets<const T extends Record<string, GameAssetType>>(
    declaration: T,
  ): { readonly [K in keyof T]: AssetHandle<T[K]> };
  // A declared asset as a URL usable in `img`, `audio`, `video`, CSS or `fetch` inside the game.
  // Rejects when the Host has no such asset or it is not of the declared type. May be called
  // before `ready()` resolves: requests wait for the Host.
  load(asset: AssetHandle): Promise<string>;
  // Loads several declared assets ahead of use; rejects with the first that fails.
  preload(assets: readonly AssetHandle[]): Promise<void>;
}

// How bridge messages travel: `postMessage` to the parent in a browser iframe, the native channel
// in a mobile WebView. The SDK picks one at run time, so one artifact runs on every Host. Tests
// inject a fake.
export interface BridgeTransport {
  post(message: GameToHostMessage): void;
  listen(handler: (message: unknown) => void): () => void;
}

// The channel a React Native WebView gives its page. It carries strings only.
export interface WebViewChannel {
  postMessage(message: string): void;
}

// The transport for the Host the game runs in: the WebView's channel when there is one, otherwise
// the parent window.
export function detectTransport(): BridgeTransport {
  const channel = (globalThis as { ReactNativeWebView?: Partial<WebViewChannel> })
    .ReactNativeWebView;
  return typeof channel?.postMessage === 'function'
    ? webViewTransport(channel as WebViewChannel)
    : windowParentTransport();
}

// In a WebView the game is the top page: messages go out through the native channel and come in
// as `message` events (dispatched on `window` or, on Android, `document`), both as JSON text.
export function webViewTransport(channel: WebViewChannel): BridgeTransport {
  return {
    post(message) {
      channel.postMessage(JSON.stringify(message));
    },
    listen(handler) {
      const onMessage = (event: Event) => {
        const data = (event as MessageEvent).data;
        if (typeof data !== 'string') return;
        let message: unknown;
        try {
          message = JSON.parse(data);
        } catch {
          return;
        }
        handler(message);
      };
      window.addEventListener('message', onMessage);
      document.addEventListener('message', onMessage);
      return () => {
        window.removeEventListener('message', onMessage);
        document.removeEventListener('message', onMessage);
      };
    },
  };
}

export function windowParentTransport(): BridgeTransport {
  return {
    post(message) {
      // The game runs in an opaque origin and cannot name the Host's origin; the Host checks that
      // the message comes from the container it created.
      window.parent.postMessage(message, '*');
    },
    listen(handler) {
      const onMessage = (event: MessageEvent) => {
        if (event.source === window.parent) handler(event.data);
      };
      window.addEventListener('message', onMessage);
      return () => window.removeEventListener('message', onMessage);
    },
  };
}

// An asset load waiting for, or awaiting, the Host's answer.
interface AssetRequest {
  handle: AssetHandle;
  settle(url: string | Error): void;
}

export class PlayhootError extends Error {
  override name = 'PlayhootError';
}

export function createPlayhoot(transport: BridgeTransport = detectTransport()): Playhoot {
  const projectionHandlers = new Set<(projection: Projection) => void>();
  const eventHandlers = new Set<(event: unknown) => void>();
  const errorHandlers = new Set<(error: unknown) => void>();
  const updateHandlers = new Set<(update: GameUpdate) => void>();
  const commands = new Map<number, (result: CommandResult) => void>();
  const assets = new Map<number, AssetRequest>();
  const assetUrls = new Map<string, Promise<string>>();
  const handles = new WeakSet<AssetHandle>();
  let declared = false;
  // Asset requests wait here and go out within the Host's limits (ADR-0006), with a margin for
  // clock differences: a request the Host dropped would never be answered.
  const queuedAssets: AssetRequest[] = [];
  const assetSentAt: number[] = [];
  let pumpTimer: ReturnType<typeof setTimeout> | null = null;
  let started: Promise<GameContext> | null = null;
  let resolveStart: ((context: GameContext) => void) | null = null;
  let rejectStart: ((error: Error) => void) | null = null;
  let running = false;
  let nextSampleId = 0;
  let nextRequestId = 0;

  const post = (message: GameToHostMessage) => {
    if (byteLength(message) > bridgeLimits.maxMessageBytes) {
      throw new PlayhootError(
        `${message.type} is over the ${bridgeLimits.maxMessageBytes}-byte limit`,
      );
    }
    transport.post(message);
  };

  const deliverUpdate = (update: GameUpdate) => {
    if (update.projection) {
      const projection = update.projection;
      projectionHandlers.forEach((handler) => handler(projection));
    }
    update.events.forEach((event) => eventHandlers.forEach((handler) => handler(event)));
    update.errors.forEach((error) => errorHandlers.forEach((handler) => handler(error)));
    updateHandlers.forEach((handler) => handler(update));
  };

  const onHostMessage = (raw: unknown) => {
    if (!isBridgeMessage(raw)) return;
    const message = raw as HostToGameMessage;
    switch (message.type) {
      case 'start':
        if (running) return;
        running = true;
        resolveStart?.(message.context);
        pumpAssets();
        // After `ready()` resolves, so the game has its context before the first projection.
        if (message.projection) {
          const projection = message.projection;
          void Promise.resolve().then(() =>
            deliverUpdate({ projection, ack: projection.ack, events: [], errors: [] }),
          );
        }
        return;
      case 'incompatible':
        rejectStart?.(new PlayhootError('this game needs a newer Playhoot'));
        return;
      case 'update':
        if (!running) return;
        deliverUpdate({
          ...(message.projection && { projection: message.projection }),
          ack: message.ack,
          events: message.events ?? [],
          errors: message.errors ?? [],
        });
        return;
      case 'command_result': {
        const resolve = commands.get(message.id);
        commands.delete(message.id);
        resolve?.(
          message.response === undefined
            ? { outcome: message.outcome }
            : { outcome: message.outcome, response: message.response },
        );
        return;
      }
      case 'asset': {
        const pending = assets.get(message.id);
        assets.delete(message.id);
        if (!pending) return;
        pumpAssets();
        if (!message.found) {
          pending.settle(new PlayhootError(`no asset "${pending.handle.key}"`));
          return;
        }
        if (!gameAssetMimeTypes[pending.handle.type].includes(message.mimeType)) {
          pending.settle(
            new PlayhootError(`asset "${pending.handle.key}" is not an ${pending.handle.type}`),
          );
          return;
        }
        pending.settle(URL.createObjectURL(new Blob([message.bytes], { type: message.mimeType })));
        return;
      }
    }
  };

  transport.listen(onHostMessage);

  const assetLimits = {
    perSecond: Math.floor(bridgeRates.request_asset.perSecond * 0.9),
    perMinute: Math.floor(bridgeRates.request_asset.perMinute * 0.9),
  };

  // Sends queued asset requests while the Host is running, its pending cap has room, and the last
  // second and minute are under the limits; otherwise tries again once the oldest send ages out.
  const pumpAssets = () => {
    if (pumpTimer !== null) return;
    while (running && queuedAssets.length > 0 && assets.size < bridgeRates.maxPendingAssets) {
      const now = Date.now();
      while (assetSentAt.length > 0 && now - (assetSentAt[0] ?? now) >= 60_000) {
        assetSentAt.shift();
      }
      const lastSecond = assetSentAt.filter((at) => now - at < 1_000);
      let waitMs = 0;
      if (assetSentAt.length >= assetLimits.perMinute) {
        waitMs = 60_000 - (now - (assetSentAt[0] ?? now));
      } else if (lastSecond.length >= assetLimits.perSecond) {
        waitMs = 1_000 - (now - (lastSecond[0] ?? now));
      }
      if (waitMs > 0) {
        pumpTimer = setTimeout(() => {
          pumpTimer = null;
          pumpAssets();
        }, waitMs);
        return;
      }
      const request = queuedAssets.shift();
      if (!request) return;
      nextRequestId += 1;
      assets.set(nextRequestId, request);
      assetSentAt.push(now);
      const key = request.handle.key;
      post({ bridge: bridgeMarker, type: 'request_asset', id: nextRequestId, key });
    }
  };

  const loadAsset = (handle: AssetHandle): Promise<string> => {
    if (!handles.has(handle)) {
      return Promise.reject(new PlayhootError('load() takes a handle returned by assets()'));
    }
    const known = assetUrls.get(handle.key);
    if (known) return known;
    const loading = new Promise<string>((resolve, reject) => {
      queuedAssets.push({
        handle,
        settle: (url) => (typeof url === 'string' ? resolve(url) : reject(url)),
      });
      pumpAssets();
    });
    // A failed load may be tried again.
    loading.catch(() => assetUrls.delete(handle.key));
    assetUrls.set(handle.key, loading);
    return loading;
  };

  const requireRunning = (what: string) => {
    if (!running) throw new PlayhootError(`${what} before ready() resolved`);
  };

  return {
    ready() {
      if (!started) {
        started = new Promise<GameContext>((resolve, reject) => {
          resolveStart = resolve;
          rejectStart = reject;
        });
        post({ bridge: bridgeMarker, type: 'ready', versions: [...bridgeVersions] });
      }
      return started;
    },
    onProjection: (handler) => subscribe(projectionHandlers, handler),
    onEvent: (handler) => subscribe(eventHandlers, handler),
    onError: (handler) => subscribe(errorHandlers, handler),
    onUpdate: (handler) => subscribe(updateHandlers, handler),
    sample(inputs) {
      requireRunning('sample()');
      nextSampleId += 1;
      post({ bridge: bridgeMarker, type: 'sample', id: nextSampleId, inputs });
      return nextSampleId;
    },
    command(name, payload) {
      requireRunning('command()');
      nextRequestId += 1;
      const id = nextRequestId;
      return new Promise<CommandResult>((resolve) => {
        commands.set(id, resolve);
        post({
          bridge: bridgeMarker,
          type: 'command',
          id,
          name,
          ...(payload !== undefined && { payload }),
        });
      });
    },
    assets(declaration) {
      if (declared) throw new PlayhootError('assets() declares every asset once');
      declared = true;
      const result: Record<string, AssetHandle> = {};
      for (const [key, type] of Object.entries(declaration)) {
        if (!gameAssetKeyPattern.test(key)) throw new PlayhootError(`invalid asset key "${key}"`);
        if (!(gameAssetTypes as readonly string[]).includes(type)) {
          throw new PlayhootError(`asset "${key}" has an unknown type "${String(type)}"`);
        }
        const handle: AssetHandle = Object.freeze({ key, type });
        handles.add(handle);
        result[key] = handle;
      }
      return Object.freeze(result) as never;
    },
    load: loadAsset,
    async preload(list) {
      await Promise.all(list.map(loadAsset));
    },
  };
}

function subscribe<T>(handlers: Set<(value: T) => void>, handler: (value: T) => void): () => void {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

function byteLength(message: GameToHostMessage): number {
  return new TextEncoder().encode(JSON.stringify(message)).length;
}
