import type {
  CommandResult,
  SessionConnection,
  SessionConnectionEvent,
  Timers,
} from '@playhoot/communication';
import {
  bridgeMarker,
  bridgeVersions,
  negotiateBridgeVersion,
  type BridgeVersion,
  type GameCommandOutcome,
  type GameContext,
  type GameToHostMessage,
  type HostToGameMessage,
} from '@playhoot/protocol/bridge';
import { decodeGameMessage } from '@playhoot/protocol/bridge/validation';

import type { ArtifactLoader, ArtifactRef } from './artifact';

// The isolated place a game runs in: a sandboxed iframe on the web, a restricted WebView on mobile.
// Each platform implements it; everything else about hosting a game is shared and lives here.
export interface GameContainer {
  // Starts the artifact in a new isolated container. `onMessage` receives whatever the game posts
  // (unvalidated); `onViolation` reports the game breaking out of its container (e.g. navigating).
  open(
    html: string,
    handlers: { onMessage(raw: unknown): void; onViolation(detail: string): void },
  ): OpenContainer;
}

export interface OpenContainer {
  send(message: HostToGameMessage): void;
  dispose(): void;
}

// What the Host needs of the player's live Session connection. A `SessionConnection` provides all
// of it except `currentView`, which the owner of the connection keeps (Session Play).
export interface GameSessionPort extends Pick<
  SessionConnection,
  'subscribe' | 'sample' | 'command'
> {
  // The player's current trustworthy state and ack (a connection sample sequence), if any.
  currentView(): { state: unknown; ack: number } | undefined;
}

// Game assets by logical key (plan §9). The bytes go to the game; where they came from never does.
export interface AssetResolver {
  resolve(key: string): Promise<{ mimeType: string; bytes: ArrayBuffer } | null>;
}

export type GameHostError =
  | { kind: 'artifact-unreachable'; detail: string }
  | { kind: 'artifact-hash-mismatch' }
  // The game never said `ready`: it failed to load, crashed, or does not use the SDK.
  | { kind: 'ready-timeout' }
  | { kind: 'unsupported-bridge-version'; offered: number[] }
  | { kind: 'container-violation'; detail: string };

export type GameHostStatus =
  | { phase: 'loading' }
  | { phase: 'starting' }
  | { phase: 'running'; version: BridgeVersion }
  | { phase: 'failed'; error: GameHostError }
  | { phase: 'disposed' };

export type GameHostEvent =
  | { type: 'status'; status: GameHostStatus }
  // A message from the game was refused (plan §17 "bridge/contract error"): recorded, not fatal.
  | { type: 'bridge-rejected'; detail: string }
  | { type: 'metric'; name: 'artifact-load-ms' | 'ready-ms'; valueMs: number };

export interface GameHost {
  readonly status: GameHostStatus;
  subscribe(listener: (event: GameHostEvent) => void): () => void;
  // Closes the container and stops forwarding. Safe to call more than once.
  dispose(): void;
}

export interface GameHostOptions {
  artifact: ArtifactRef;
  loader: ArtifactLoader;
  container: GameContainer;
  session: GameSessionPort;
  context: GameContext;
  assets?: AssetResolver;
  timers?: Timers;
  readyTimeoutMs?: number;
}

export const defaultReadyTimeoutMs = 10_000;

const defaultTimers: Timers = {
  now: () => Date.now(),
  setTimeout: (run, delayMs) => globalThis.setTimeout(run, delayMs),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

const noAssets: AssetResolver = { resolve: () => Promise.resolve(null) };

// Runs one GameVersion artifact for one player (plan §10, §13.3): load and verify the artifact,
// open the container, wait for READY, send the context and the current projection, then translate
// between the game and the Session until disposed. The game never sees the connection, tokens,
// signed URLs, command tokens or connection sample sequences.
export function startGameHost(options: GameHostOptions): GameHost {
  const timers = options.timers ?? defaultTimers;
  const assets = options.assets ?? noAssets;
  const listeners = new Set<(event: GameHostEvent) => void>();
  let status: GameHostStatus = { phase: 'loading' };
  let container: OpenContainer | null = null;
  let readyTimer: unknown = null;
  let unsubscribeSession: (() => void) | null = null;
  const acks = createAckTranslator();

  const emit = (event: GameHostEvent) => listeners.forEach((listener) => listener(event));
  const setStatus = (next: GameHostStatus) => {
    status = next;
    emit({ type: 'status', status });
  };
  const active = () => status.phase !== 'failed' && status.phase !== 'disposed';
  const send = (message: HostToGameMessage) => {
    if (active()) container?.send(message);
  };

  const stop = () => {
    if (readyTimer !== null) timers.clearTimeout(readyTimer);
    readyTimer = null;
    unsubscribeSession?.();
    unsubscribeSession = null;
    container?.dispose();
    container = null;
  };
  const fail = (error: GameHostError) => {
    if (!active()) return;
    stop();
    setStatus({ phase: 'failed', error });
  };
  const reject = (detail: string) => emit({ type: 'bridge-rejected', detail });

  const onSessionEvent = (event: SessionConnectionEvent) => {
    if (status.phase !== 'running') return;
    if (event.type === 'sample-sent') {
      acks.sent(event.sequence);
      return;
    }
    if (event.type !== 'view') return;
    const update = event.update;
    const ack = acks.translate(update.ack);
    send({
      bridge: bridgeMarker,
      type: 'update',
      ...(update.kind === 'state' && {
        projection: { state: update.state, full: update.full, ack },
      }),
      ack,
      events: update.events,
      errors: update.errors,
    });
  };

  const onReady = (offered: number[], openedAt: number) => {
    if (status.phase !== 'starting') {
      reject('ready after the game started');
      return;
    }
    if (readyTimer !== null) timers.clearTimeout(readyTimer);
    readyTimer = null;
    const version = negotiateBridgeVersion(offered);
    if (version === null) {
      container?.send({
        bridge: bridgeMarker,
        type: 'incompatible',
        supported: [...bridgeVersions],
      });
      fail({ kind: 'unsupported-bridge-version', offered });
      return;
    }
    emit({ type: 'metric', name: 'ready-ms', valueMs: timers.now() - openedAt });
    setStatus({ phase: 'running', version });
    unsubscribeSession = options.session.subscribe(onSessionEvent);
    const view = options.session.currentView();
    send({
      bridge: bridgeMarker,
      type: 'start',
      version,
      context: options.context,
      projection: view ? { state: view.state, full: true, ack: acks.translate(view.ack) } : null,
    });
  };

  const onGameMessage = (message: GameToHostMessage, openedAt: number) => {
    if (message.type === 'ready') {
      onReady(message.versions, openedAt);
      return;
    }
    if (status.phase !== 'running') {
      reject(`${message.type} before ready`);
      return;
    }
    switch (message.type) {
      case 'sample':
        if (!acks.sampled(message.id)) {
          reject('sample id not increasing');
          return;
        }
        options.session.sample(message.inputs);
        return;
      case 'command': {
        const id = message.id;
        void options.session.command(message.name, message.payload).then((result) => {
          const outcome = gameCommandOutcome(result);
          send({
            bridge: bridgeMarker,
            type: 'command_result',
            id,
            outcome,
            ...(outcome === 'executed' &&
              result.response !== undefined && { response: result.response }),
          });
        });
        return;
      }
      case 'request_asset': {
        const { id, key } = message;
        void assets
          .resolve(key)
          .catch(() => null)
          .then((asset) =>
            send(
              asset
                ? { bridge: bridgeMarker, type: 'asset', id, key, found: true, ...asset }
                : { bridge: bridgeMarker, type: 'asset', id, key, found: false },
            ),
          );
        return;
      }
    }
  };

  const open = (html: string) => {
    if (!active()) return;
    setStatus({ phase: 'starting' });
    const openedAt = timers.now();
    container = options.container.open(html, {
      onMessage(raw) {
        if (!active()) return;
        const decoded = decodeGameMessage(raw);
        if (decoded === null) return;
        if (!decoded.ok) reject(decoded.detail);
        else onGameMessage(decoded.message, openedAt);
      },
      onViolation: (detail) => fail({ kind: 'container-violation', detail }),
    });
    readyTimer = timers.setTimeout(
      () => fail({ kind: 'ready-timeout' }),
      options.readyTimeoutMs ?? defaultReadyTimeoutMs,
    );
  };

  const startedAt = timers.now();
  void options.loader.load(options.artifact).then((result) => {
    if (!active()) return;
    if (!result.ok) {
      fail(
        result.error.kind === 'hash-mismatch'
          ? { kind: 'artifact-hash-mismatch' }
          : { kind: 'artifact-unreachable', detail: result.error.detail },
      );
      return;
    }
    emit({ type: 'metric', name: 'artifact-load-ms', valueMs: timers.now() - startedAt });
    open(result.value);
  });

  return {
    get status() {
      return status;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      if (status.phase === 'disposed') return;
      stop();
      setStatus({ phase: 'disposed' });
      listeners.clear();
    },
  };
}

function gameCommandOutcome(result: CommandResult): GameCommandOutcome {
  switch (result.outcome) {
    case 'executed':
    case 'already_processed':
      return 'executed';
    case 'invalid':
    case 'too-large':
      return 'rejected';
    default:
      return 'unavailable';
  }
}

// Translates the backend's ack (a per-connection sample sequence) into the game's own sample ids,
// so the game can reconcile its prediction without knowing about connections.
export function createAckTranslator() {
  let latestGameId = 0;
  let ackedGameId = 0;
  // Connection sequence -> the game sample it carried, oldest first, pruned as acks arrive.
  let sent: Array<{ sequence: number; gameId: number }> = [];

  return {
    // The game sent sample `id`. False when it does not grow (refused).
    sampled(id: number): boolean {
      if (id <= latestGameId) return false;
      latestGameId = id;
      return true;
    },
    // The connection sent `sequence` carrying the latest sample (it coalesces older ones away).
    sent(sequence: number) {
      sent.push({ sequence, gameId: latestGameId });
    },
    translate(ackSequence: number): number {
      const consumed = sent.filter((entry) => entry.sequence <= ackSequence);
      const last = consumed[consumed.length - 1];
      if (last) {
        ackedGameId = Math.max(ackedGameId, last.gameId);
        sent = sent.filter((entry) => entry.sequence >= last.sequence);
      }
      return ackedGameId;
    },
  };
}
