import type {
  CommandResult,
  ConnectionCloseKind,
  GamesClient,
  GamesFailure,
  PreviewCloseKind,
  PreviewConnection,
  PreviewConnector,
  SessionConnectionEvent,
} from '@playhoot/communication';
import { createStore, type StoreApi } from 'zustand/vanilla';

// What the GameHost needs to run the preview's game for one participant: the same surface as a
// player's live connection (`GameSessionPort` of `@playhoot/game-host`).
export interface PreviewPort {
  subscribe(listener: (event: SessionConnectionEvent) => void): () => void;
  sample(inputs: Record<string, unknown>): void;
  command(name: string, payload?: Record<string, unknown> | null): Promise<CommandResult>;
  currentView(): { state: unknown; ack: number } | undefined;
  reportGameFault(): boolean;
}

// The game's frontend the preview runs, as the GameHost takes it.
export interface PreviewFrontend {
  url: string;
  sha256: string;
  viewport: { aspectRatio: string; width: number; height: number };
  assets: {
    key: string;
    type: string;
    mimeType: string;
    sha256: string;
    size: number;
    url: string;
  }[];
}

export interface RunningPreview {
  previewUUID: string;
  // The revision whose build is being tested: the draft may have moved on since.
  revision: number;
  participants: string[];
  // Who the person plays as; null until the backend confirms the start.
  actingAs: string | null;
  paused: boolean;
  frontend: PreviewFrontend | null;
}

// Why a preview stopped: the backend's reason (`finished`, `idle`, ... or one this client does not
// know), or the connection ending without one.
export type PreviewEnd =
  | { kind: 'ended'; reason: string }
  | { kind: 'rejected'; reason: string }
  | { kind: 'connection'; close: PreviewCloseKind };

export type PreviewStartFailure =
  | { kind: 'build-not-ready'; buildStatus: string | null }
  | { kind: 'invalid-players'; min: number | null; max: number | null }
  // The game's start() failed in its script: the Escenarios section shows why.
  | { kind: 'script-failure' }
  | { kind: 'busy' }
  | { kind: 'not-found' }
  | { kind: 'no-credential' }
  | { kind: 'unavailable' };

// Something the backend reported while the preview goes on: the game sent a SAMPLE or COMMAND it
// does not declare, or a participant switch named one the preview does not have.
export type PreviewNotice =
  | { kind: 'invalid-game-data'; detail: string | null }
  | { kind: 'unknown-participant'; detail: string | null }
  | { kind: 'other'; code: string; detail: string | null };

export type PreviewPhase =
  | { phase: 'idle' }
  | { phase: 'starting' }
  | { phase: 'running'; preview: RunningPreview }
  | { phase: 'ended'; end: PreviewEnd; last: RunningPreview | null };

export interface PreviewState {
  view: PreviewPhase;
  // How many synthetic participants the next preview has.
  players: number;
  // The range the game accepts, once the backend told it (a refused number of players).
  range: { min: number | null; max: number | null } | null;
  startFailure: PreviewStartFailure | null;
  // The last problem reported during the running preview, until dismissed or a new start.
  notice: PreviewNotice | null;
}

export interface GamePreview {
  store: StoreApi<PreviewState>;
  setPlayers(players: number): void;
  // Opens a preview of the current revision's build (ending any previous one) and connects.
  start(): Promise<void>;
  // Plays as another participant: the GameHost runs anew for them (`port`).
  actAs(participantId: string): void;
  pause(): void;
  resume(): void;
  end(): void;
  dismissNotice(): void;
  // The live link the GameHost of `participantId` runs on: it only passes that participant's views
  // and actions, so a game still running for the previous participant cannot act for the new one.
  port(participantId: string): PreviewPort;
  dispose(): void;
}

export interface GamePreviewDeps {
  games: Pick<GamesClient, 'createPreview'>;
  previews: PreviewConnector;
}

export const defaultPreviewPlayers = 2;

// The workspace's "Probar juego": a private test game of the draft's build that the creator plays
// as each synthetic participant in turn. The connection and every rule about the game stay with the
// backend; this keeps what the screen needs and gives the GameHost a link per participant.
export function createGamePreview(gameUUID: string, deps: GamePreviewDeps): GamePreview {
  const store = createStore<PreviewState>(() => ({
    view: { phase: 'idle' },
    players: defaultPreviewPlayers,
    range: null,
    startFailure: null,
    notice: null,
  }));
  const portListeners = new Set<(event: SessionConnectionEvent) => void>();
  let connection: PreviewConnection | null = null;
  let stopListening: (() => void) | null = null;
  let disposed = false;

  const running = (): RunningPreview | null => {
    const view = store.getState().view;
    return view.phase === 'running' ? view.preview : null;
  };
  const setRunning = (change: (preview: RunningPreview) => RunningPreview) => {
    const preview = running();
    if (preview) store.setState({ view: { phase: 'running', preview: change(preview) } });
  };
  const drop = () => {
    stopListening?.();
    stopListening = null;
    connection?.close();
    connection = null;
  };
  const finish = (end: PreviewEnd) => {
    const view = store.getState().view;
    if (view.phase === 'ended') return;
    store.setState({ view: { phase: 'ended', end, last: running() } });
  };

  const listen = (live: PreviewConnection) => {
    stopListening = live.subscribe((event) => {
      if (live !== connection) return;
      switch (event.type) {
        case 'message': {
          const message = event.message;
          switch (message.type) {
            case 'preview_started':
              setRunning((preview) => ({
                ...preview,
                revision: message.revision,
                participants: message.participants,
                actingAs: message.acting_as,
                paused: message.paused,
                frontend: {
                  url: message.frontend.url,
                  sha256: message.frontend.sha256,
                  viewport: {
                    aspectRatio: message.frontend.viewport.aspect_ratio,
                    width: message.frontend.viewport.width,
                    height: message.frontend.viewport.height,
                  },
                  assets: message.frontend.assets.map((asset) => ({
                    key: asset.key,
                    type: asset.type,
                    mimeType: asset.mime_type,
                    sha256: asset.sha256,
                    size: asset.size,
                    url: asset.url,
                  })),
                },
              }));
              return;
            case 'acting_as':
              setRunning((preview) => ({ ...preview, actingAs: message.participant_id }));
              return;
            case 'paused':
              setRunning((preview) => ({ ...preview, paused: true }));
              return;
            case 'resumed':
              setRunning((preview) => ({ ...preview, paused: false }));
              return;
            case 'preview_ended':
              finish({ kind: 'ended', reason: message.reason });
              return;
            case 'rejected':
              finish({ kind: 'rejected', reason: message.reason });
              return;
            case 'error':
              store.setState({ notice: noticeOf(message.code, message.detail ?? null) });
              return;
          }
          return;
        }
        case 'view':
          portListeners.forEach((listener) => listener({ type: 'view', update: event.update }));
          return;
        case 'sample-sent':
        case 'resync-requested':
        case 'protocol-error':
          portListeners.forEach((listener) => listener(event));
          return;
        case 'closed':
          portListeners.forEach((listener) =>
            listener({ ...event, kind: sessionCloseKind(event.kind) }),
          );
          drop();
          finish({ kind: 'connection', close: event.kind });
          return;
        case 'open':
          return;
      }
    });
  };

  return {
    store,
    setPlayers(players) {
      if (Number.isInteger(players) && players > 0) store.setState({ players });
    },
    async start() {
      if (disposed || store.getState().view.phase === 'starting') return;
      drop();
      store.setState({ view: { phase: 'starting' }, startFailure: null, notice: null });
      const created = await deps.games.createPreview(gameUUID, store.getState().players);
      if (disposed) return;
      if (!created.ok) {
        const failure = startFailureOf(created.error);
        store.setState({
          view: { phase: 'idle' },
          startFailure: failure,
          ...(failure.kind === 'invalid-players' && {
            range: { min: failure.min, max: failure.max },
          }),
        });
        return;
      }
      const connected = deps.previews.connect(created.value.previewUUID);
      if (!connected.ok) {
        store.setState({ view: { phase: 'idle' }, startFailure: { kind: 'no-credential' } });
        return;
      }
      connection = connected.value;
      listen(connected.value);
      store.setState({
        view: {
          phase: 'running',
          preview: {
            previewUUID: created.value.previewUUID,
            revision: created.value.revision,
            participants: created.value.participants,
            actingAs: null,
            paused: false,
            frontend: null,
          },
        },
      });
    },
    actAs(participantId) {
      const preview = running();
      if (!preview || preview.actingAs === participantId || !connection) return;
      connection.actAs(participantId);
    },
    pause: () => void connection?.pause(),
    resume: () => void connection?.resume(),
    end: () => void connection?.end(),
    dismissNotice: () => store.setState({ notice: null }),
    port(participantId) {
      const acting = () => connection?.actingAs === participantId;
      return {
        subscribe(listener) {
          const forward = (event: SessionConnectionEvent) => {
            if (event.type === 'closed' || acting()) listener(event);
          };
          portListeners.add(forward);
          return () => portListeners.delete(forward);
        },
        // Only the acted-as participant's game may act: one still shown for the previous
        // participant (being replaced) is dropped.
        sample(inputs) {
          if (acting()) connection?.sample(inputs);
        },
        command(name, payload) {
          if (!acting() || !connection) {
            return Promise.resolve({ token: '', outcome: 'connection-closed' });
          }
          return connection.command(name, payload);
        },
        currentView() {
          const view = connection?.currentView();
          return view && view.participantId === participantId
            ? { state: view.state, ack: view.ack }
            : undefined;
        },
        // A preview keeps no audit of game faults: the creator sees the failure on screen.
        reportGameFault: () => false,
      };
    },
    dispose() {
      disposed = true;
      drop();
      portListeners.clear();
    },
  };
}

function startFailureOf(failure: GamesFailure): PreviewStartFailure {
  switch (failure.kind) {
    case 'build-not-ready':
      return { kind: 'build-not-ready', buildStatus: failure.buildStatus };
    case 'invalid-players':
      return { kind: 'invalid-players', min: failure.min, max: failure.max };
    case 'script-failure':
      return { kind: 'script-failure' };
    case 'busy':
      return { kind: 'busy' };
    case 'not-found':
      return { kind: 'not-found' };
    default:
      return { kind: 'unavailable' };
  }
}

function noticeOf(code: string, detail: string | null): PreviewNotice {
  switch (code) {
    case 'invalid_game_data':
      return { kind: 'invalid-game-data', detail };
    case 'unknown_participant':
      return { kind: 'unknown-participant', detail };
    default:
      return { kind: 'other', code, detail };
  }
}

// The GameHost reads a closed link as a player's connection ending.
function sessionCloseKind(kind: PreviewCloseKind): ConnectionCloseKind {
  switch (kind) {
    case 'ended':
      return 'session-ended';
    case 'replaced':
      return 'replaced';
    case 'protocol':
      return 'protocol';
    case 'unreachable':
      return 'unreachable';
    default:
      return 'retryable';
  }
}
