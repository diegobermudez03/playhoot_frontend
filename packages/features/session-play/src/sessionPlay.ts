import {
  startGameHost,
  type ArtifactLoader,
  type AssetLoader,
  type GameAssetRef,
  type GameContainer,
  type GameHost,
  type GameHostError,
  type GameHostEvent,
  type GameHostStatus,
  type GameSessionPort,
  type GameViewport,
} from '@playhoot/game-host';
import { createStore, type StoreApi } from 'zustand/vanilla';

// What the start of the game told this player (`session_started`).
export interface SessionPlayStart {
  participantId: string;
  participants: string[];
  frontend: { url: string; sha256: string; viewport: GameViewport; assets: GameAssetRef[] };
}

export interface SessionPlayState {
  game: GameHostStatus;
  // Game messages the Host refused so far (plan §17, bridge/contract errors).
  refusedGameMessages: number;
}

// Observability (plan §17): what happened, for whatever sink the app wires (a console in development).
export type SessionPlayTelemetry =
  | Exclude<GameHostEvent, { type: 'status' }>
  | {
      type: 'game-failed';
      error: Extract<GameHostStatus, { phase: 'failed' }>['error'];
    };

export interface SessionPlayDeps {
  // The player's live connection, kept across reconnections by whoever owns it (Join Session).
  live: GameSessionPort;
  loader: ArtifactLoader;
  // Downloads and caches the game's assets; without it the game gets none.
  assets?: AssetLoader;
  onTelemetry?: (event: SessionPlayTelemetry) => void;
  // The game was stopped for misbehaving (`endsParticipation`): the player must leave the Session.
  // The GameHost already reported it to the backend on the same connection, before this.
  onGameStopped?: () => void;
}

// Failures that make the game suspicious, not unlucky (ADR-0006): it abused the bridge, tried to
// leave its container, or is not the artifact the backend pinned. The player leaves the Session
// instead of trying again, which would run the same game. Other failures (download, no READY,
// version) may pass and keep "Try again".
export function endsParticipation(error: GameHostError): boolean {
  return (
    error.kind === 'bridge-abuse' ||
    error.kind === 'container-violation' ||
    error.kind === 'artifact-hash-mismatch'
  );
}

export interface SessionPlay {
  store: StoreApi<SessionPlayState>;
  // Runs the game in this container (the presentation's game area). Returns a detach function.
  attach(container: GameContainer): () => void;
  // After a failure, loads the game again in the attached container.
  reload(): void;
  dispose(): void;
}

// Session Play (plan §12, §13.3): runs the GameVersion's frontend for the player once the game has
// started, through the GameHost, and keeps what the screen needs to know about it. Lifecycle,
// connection and endings stay with Join Session, which owns the connection; nothing here touches
// a socket or an iframe.
export function createSessionPlay(
  start: SessionPlayStart,
  locale: string,
  deps: SessionPlayDeps,
): SessionPlay {
  const store = createStore<SessionPlayState>(() => ({
    game: { phase: 'loading' },
    refusedGameMessages: 0,
  }));
  let container: GameContainer | null = null;
  let host: GameHost | null = null;
  let disposed = false;

  const stopHost = () => {
    host?.dispose();
    host = null;
  };

  const run = () => {
    stopHost();
    if (disposed || !container) return;
    const current = startGameHost({
      artifact: { url: start.frontend.url, sha256: start.frontend.sha256 },
      viewport: start.frontend.viewport,
      loader: deps.loader,
      container,
      session: deps.live,
      context: { participantId: start.participantId, participants: start.participants, locale },
      ...(deps.assets && { assets: deps.assets.resolverFor(start.frontend.assets) }),
    });
    host = current;
    store.setState({ game: current.status });
    current.subscribe((event) => {
      if (host !== current) return;
      switch (event.type) {
        case 'status':
          store.setState({ game: event.status });
          if (event.status.phase === 'failed') {
            deps.onTelemetry?.({ type: 'game-failed', error: event.status.error });
            if (endsParticipation(event.status.error)) deps.onGameStopped?.();
          }
          return;
        case 'bridge-rejected':
          store.setState((state) => ({ refusedGameMessages: state.refusedGameMessages + 1 }));
          deps.onTelemetry?.(event);
          return;
        case 'metric':
          deps.onTelemetry?.(event);
          return;
      }
    });
  };

  return {
    store,
    attach(next) {
      container = next;
      run();
      return () => {
        if (container !== next) return;
        stopHost();
        container = null;
      };
    },
    reload: run,
    dispose() {
      disposed = true;
      stopHost();
      container = null;
    },
  };
}
