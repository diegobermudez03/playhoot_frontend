// API exposed to the generated game frontend. Responsibility and boundaries: see ../README.md.
import {
  bridgeLimits,
  bridgeMarker,
  bridgeVersions,
  isBridgeMessage,
  type GameCommandOutcome,
  type GameContext,
  type GameToHostMessage,
  type HostToGameMessage,
  type Projection,
} from '@playhoot/protocol/bridge';

export type { GameCommandOutcome, GameContext, Projection } from '@playhoot/protocol/bridge';

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
  // An asset declared by the game, as a URL usable in `img`, `audio`, CSS or `fetch` inside the
  // game. Rejects when the Host has no such asset.
  requestAsset(key: string): Promise<string>;
}

// How bridge messages travel. In a browser iframe this is `postMessage` to the parent; a WebView
// host provides its own. Tests inject a fake.
export interface BridgeTransport {
  post(message: GameToHostMessage): void;
  listen(handler: (message: unknown) => void): () => void;
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

export class PlayhootError extends Error {
  override name = 'PlayhootError';
}

export function createPlayhoot(transport: BridgeTransport = windowParentTransport()): Playhoot {
  const projectionHandlers = new Set<(projection: Projection) => void>();
  const eventHandlers = new Set<(event: unknown) => void>();
  const errorHandlers = new Set<(error: unknown) => void>();
  const updateHandlers = new Set<(update: GameUpdate) => void>();
  const commands = new Map<number, (result: CommandResult) => void>();
  const assets = new Map<number, { resolve(url: string): void; reject(error: Error): void }>();
  const assetUrls = new Map<string, string>();
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
        if (!message.found) {
          pending.reject(new PlayhootError(`no asset "${message.key}"`));
          return;
        }
        const url = URL.createObjectURL(new Blob([message.bytes], { type: message.mimeType }));
        assetUrls.set(message.key, url);
        pending.resolve(url);
        return;
      }
    }
  };

  transport.listen(onHostMessage);

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
    requestAsset(key) {
      requireRunning('requestAsset()');
      const known = assetUrls.get(key);
      if (known) return Promise.resolve(known);
      nextRequestId += 1;
      const id = nextRequestId;
      return new Promise<string>((resolve, reject) => {
        assets.set(id, { resolve, reject });
        post({ bridge: bridgeMarker, type: 'request_asset', id, key });
      });
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
