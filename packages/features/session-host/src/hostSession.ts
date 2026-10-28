import type { AppState } from '@playhoot/app-core';
import type {
  AdminConnection,
  AdminConnectionEvent,
  AdminConnector,
  CommandResult,
  ConnectionCloseKind,
  SessionConnectionEvent,
} from '@playhoot/communication';
import type { AdminServerMessage } from '@playhoot/protocol';
import { createStore, type StoreApi } from 'zustand/vanilla';

export interface HostLobbyMember {
  userUUID: string;
  displayName: string;
  // The creator's own player connection, when they play too.
  isYou: boolean;
}

export interface HostParticipant {
  participantId: string;
  userUUID: string;
  displayName: string;
  isYou: boolean;
}

export interface HostStartedSession {
  participants: HostParticipant[];
  frontend: {
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
  };
}

// Why starting did not happen. The backend stays the authority: the client's own check of the
// player count only enables the button.
export type StartError =
  | 'invalid_player_count'
  | 'game_unavailable'
  | 'start_failed'
  | 'sandbox_unavailable'
  | 'not_in_lobby'
  // No answer (the connection ended) or an outcome this client does not know.
  | 'unavailable';

export type HostOutcome =
  | { kind: 'rejected'; reason: string }
  // The admin connection's first handshake failed: network, authorization or limits.
  | { kind: 'unreachable' }
  | { kind: 'ended'; status: string; endCause: string }
  | { kind: 'connection-lost' }
  | { kind: 'protocol-error' };

export type HostView =
  | { phase: 'connecting'; reconnectAttempt: number }
  | {
      phase: 'lobby';
      members: HostLobbyMember[];
      // How many players the game can start with; null when the backend did not say.
      minPlayers: number | null;
      maxPlayers: number | null;
      starting: boolean;
      startError: StartError | null;
    }
  // The game runs. `watching` is the participant whose view the admin gets, null while choosing.
  | {
      phase: 'started';
      session: HostStartedSession;
      connection: 'connected' | 'reconnecting';
      watching: string | null;
    }
  | { phase: 'closed'; outcome: HostOutcome };

export interface HostSessionState {
  sessionUUID: string;
  // Known when this page created the Session (the backend does not send it to admins).
  joinCode: string | null;
  view: HostView;
  // The creator joined as a player from this page: they get the player screen here.
  playing: boolean;
  // The backend refuses to show other players to a creator who plays (here or on another device).
  watchBlocked: boolean;
  // "Join and start": the game starts as soon as the creator's player connection is in the lobby.
  startWhenJoined: boolean;
  cancelling: boolean;
}

export interface HostSessionDeps {
  app: AppState;
  connector: AdminConnector;
  schedule?: (run: () => void, delayMs: number) => () => void;
}

// The watched participant's views as the GameHost needs them (read only: the admin never sends
// inputs or commands). An `open` event marks each new admin connection or newly watched player.
export interface HostLive {
  subscribe(listener: (event: SessionConnectionEvent) => void): () => void;
  sample(inputs: Record<string, unknown>): void;
  command(name: string, payload?: Record<string, unknown> | null): Promise<CommandResult>;
  currentView(): { state: unknown; ack: number } | undefined;
  reportGameFault(): boolean;
}

export interface HostSession {
  store: StoreApi<HostSessionState>;
  live: HostLive;
  start(): void;
  startGame(): Promise<void>;
  cancel(): Promise<void>;
  watch(participantId: string): Promise<void>;
  // The creator also joins as a player (lobby only): the app opens a player connection for them.
  playToo(): void;
  // Joins as a player (lobby only) and starts once that player connection is in the lobby.
  joinAndStart(): void;
  // The creator's current player connection reached the lobby. Told by whoever owns that connection,
  // never inferred from the admin's lobby updates: an older player connection closing may still be
  // listed there, and starting then would leave the creator out of the game.
  playerInLobby(): void;
  // Their player connection ended (they left, or joining was refused): back to the admin screens,
  // and a pending "join and start" is dropped.
  stopPlaying(): void;
  retry(): void;
  dispose(): void;
}

export const hostReconnectDelaysMs = [1000, 2000, 4000] as const;

// Whether the creator is among the lobby's players (from this page or another device).
export function hostPlays(view: Extract<HostView, { phase: 'lobby' }>): boolean {
  return view.members.some((member) => member.isYou);
}

// Whether the lobby has a player count the game can start with, as far as the client knows.
export function canStart(view: Extract<HostView, { phase: 'lobby' }>): boolean {
  const count = view.members.length;
  if (count === 0) return false;
  if (view.minPlayers !== null && count < view.minPlayers) return false;
  return !(view.maxPlayers !== null && view.maxPlayers > 0 && count > view.maxPlayers);
}

// Session Host: the creator's side of a Session (plan §12; session-play-v1 CHECKLIST P). One admin
// connection, kept across reconnections; the backend decides everything it answers.
export function createHostSession(
  sessionUUID: string,
  joinCode: string | null,
  deps: HostSessionDeps,
): HostSession {
  const schedule =
    deps.schedule ??
    ((run, delayMs) => {
      const id = setTimeout(run, delayMs);
      return () => clearTimeout(id);
    });
  const store = createStore<HostSessionState>(() => ({
    sessionUUID,
    joinCode,
    view: { phase: 'connecting', reconnectAttempt: 0 },
    playing: false,
    watchBlocked: false,
    startWhenJoined: false,
    cancelling: false,
  }));
  const liveListeners = new Set<(event: SessionConnectionEvent) => void>();
  let connection: AdminConnection | null = null;
  let cancelReconnect: (() => void) | null = null;
  let disposed = false;

  const setView = (view: HostView) => store.setState({ view });
  const me = () => {
    const auth = deps.app.store.getState().auth;
    return auth.status === 'guest' || auth.status === 'authenticated' ? auth.userUUID : null;
  };
  const toLive = (event: SessionConnectionEvent) =>
    liveListeners.forEach((listener) => listener(event));

  const dropConnection = () => {
    cancelReconnect?.();
    cancelReconnect = null;
    connection?.close();
    connection = null;
  };

  const connect = (attempt: number) => {
    if (disposed) return;
    dropConnection();
    const result = deps.connector.connect(sessionUUID);
    if (!result.ok) return; // no credential: the route sends the person to sign in
    const view = store.getState().view;
    if (view.phase === 'started') setView({ ...view, connection: 'reconnecting' });
    else setView({ phase: 'connecting', reconnectAttempt: attempt });
    const current = result.value;
    connection = current;
    let opened = false;
    current.subscribe((event) => {
      if (disposed || connection !== current) return;
      onEvent(
        event,
        attempt,
        () => opened,
        (value) => (opened = value),
      );
    });
  };

  const onEvent = (
    event: AdminConnectionEvent,
    attempt: number,
    wasOpened: () => boolean,
    setOpened: (value: boolean) => void,
  ) => {
    switch (event.type) {
      case 'open':
        setOpened(true);
        return;
      case 'message':
        onMessage(event.message);
        return;
      case 'view': {
        // Only the watched participant's views reach the game: one of the previous participant
        // arriving after a switch would show their state under another name.
        if (!isWatched(event.participantId)) return;
        const update = event.update;
        if (update.kind === 'state' && update.full) toLive({ type: 'open' });
        toLive({ type: 'view', update });
        return;
      }
      case 'resync-requested':
        return;
      case 'protocol-error':
        dropConnection();
        setView({ phase: 'closed', outcome: { kind: 'protocol-error' } });
        return;
      case 'closed':
        connection = null;
        onClosed(event.kind, attempt, wasOpened());
        return;
    }
  };

  const onMessage = (message: Exclude<AdminServerMessage, { type: 'player_view' }>) => {
    const you = me();
    switch (message.type) {
      case 'rejected':
        dropConnection();
        setView({ phase: 'closed', outcome: { kind: 'rejected', reason: message.reason } });
        return;
      case 'lobby_update': {
        const view = store.getState().view;
        setView({
          phase: 'lobby',
          members: message.members.map((m) => ({
            userUUID: m.user_uuid,
            displayName: m.display_name,
            isYou: m.user_uuid === you,
          })),
          minPlayers: message.min_players ?? null,
          maxPlayers: message.max_players ?? null,
          starting: view.phase === 'lobby' ? view.starting : false,
          startError: view.phase === 'lobby' ? view.startError : null,
        });
        return;
      }
      case 'session_started': {
        const participants = message.participants.map((p) => ({
          participantId: p.participant_id,
          userUUID: p.user_uuid,
          displayName: p.display_name,
          isYou: p.user_uuid === you,
        }));
        const previous = store.getState().view;
        setView({
          phase: 'started',
          session: {
            participants,
            frontend: {
              url: message.frontend.url,
              sha256: message.frontend.sha256,
              viewport: {
                aspectRatio: message.frontend.viewport.aspect_ratio,
                width: message.frontend.viewport.width,
                height: message.frontend.viewport.height,
              },
              assets: message.frontend.assets.map((a) => ({
                key: a.key,
                type: a.type,
                mimeType: a.mime_type,
                sha256: a.sha256,
                size: a.size,
                url: a.url,
              })),
            },
          },
          connection: 'connected',
          // A reconnection keeps watching the same participant.
          watching: previous.phase === 'started' ? previous.watching : null,
        });
        // Watch someone right away: the same participant after a reconnection, else the first.
        const watching = previous.phase === 'started' ? previous.watching : null;
        const target = watching ?? participants[0]?.participantId;
        const { playing, watchBlocked } = store.getState();
        if (target && !playing && !watchBlocked) void watch(target);
        return;
      }
      case 'session_ended':
      case 'lobby_closed':
        setView({
          phase: 'closed',
          outcome: { kind: 'ended', status: message.status, endCause: message.end_cause },
        });
        return;
    }
  };

  const onClosed = (kind: ConnectionCloseKind, attempt: number, opened: boolean) => {
    const view = store.getState().view;
    if (view.phase === 'closed') return;
    switch (kind) {
      case 'session-ended':
        setView({ phase: 'closed', outcome: { kind: 'ended', status: '', endCause: '' } });
        return;
      case 'protocol':
      case 'game-data-invalid':
        setView({ phase: 'closed', outcome: { kind: 'protocol-error' } });
        return;
      default: {
        if (kind === 'unreachable' && attempt === 0) {
          setView({ phase: 'closed', outcome: { kind: 'unreachable' } });
          return;
        }
        const next = opened ? 1 : attempt + 1;
        const delay = hostReconnectDelaysMs[next - 1];
        if (delay === undefined) {
          setView({ phase: 'closed', outcome: { kind: 'connection-lost' } });
          return;
        }
        if (view.phase === 'started') setView({ ...view, connection: 'reconnecting' });
        else setView({ phase: 'connecting', reconnectAttempt: next });
        cancelReconnect = schedule(() => {
          cancelReconnect = null;
          connect(next);
        }, delay);
      }
    }
  };

  const isWatched = (participantId: string) => {
    const view = store.getState().view;
    return view.phase === 'started' && view.watching === participantId;
  };

  const watch = async (participantId: string) => {
    const current = connection;
    if (!current) return;
    const view = store.getState().view;
    const previous = view.phase === 'started' ? view.watching : null;
    if (view.phase === 'started') setView({ ...view, watching: participantId });
    const outcome = await current.selectPerspective(participantId);
    if (outcome === 'selected') return;
    if (outcome === 'creator_is_playing') store.setState({ watchBlocked: true });
    // Not selected: no game stays bound to that participant. Back to the one watched before, unless
    // the creator cannot watch anyone or another switch happened meanwhile.
    const after = store.getState().view;
    if (after.phase !== 'started' || after.watching !== participantId) return;
    setView({
      ...after,
      watching: outcome === 'creator_is_playing' ? null : previous,
    });
  };

  const startGame = async () => {
    const view = store.getState().view;
    if (view.phase !== 'lobby' || view.starting || !connection) return;
    setView({ ...view, starting: true, startError: null });
    const outcome = await connection.startSession();
    const after = store.getState().view;
    if (after.phase !== 'lobby') return; // started (session_started) or ended meanwhile
    const startError: StartError | null =
      outcome === 'started' || outcome === 'already_started' || outcome === 'start_in_progress'
        ? null
        : outcome === 'connection-closed' || outcome === 'unknown'
          ? 'unavailable'
          : outcome;
    setView({ ...after, starting: false, startError });
  };

  const live: HostLive = {
    subscribe(listener) {
      liveListeners.add(listener);
      return () => liveListeners.delete(listener);
    },
    // Read only: what the watched player's game sends never leaves this device.
    sample: () => undefined,
    command: () => Promise.resolve({ token: '', outcome: 'connection-closed' }),
    // Only the watched participant's state: before their FULL view arrives the game starts empty and
    // gets it as an update.
    currentView() {
      const view = connection?.currentView();
      return view && isWatched(view.participantId) ? { state: view.state, ack: 0 } : undefined;
    },
    reportGameFault: () => false,
  };

  return {
    store,
    live,
    start: () => connect(0),
    startGame,
    async cancel() {
      if (!connection || store.getState().cancelling) return;
      store.setState({ cancelling: true });
      await connection.cancelSession();
      // The end itself arrives as lobby_closed / session_ended.
      store.setState({ cancelling: false });
    },
    watch,
    playToo() {
      if (store.getState().view.phase === 'lobby') store.setState({ playing: true });
    },
    joinAndStart() {
      if (store.getState().view.phase !== 'lobby') return;
      store.setState({ playing: true, startWhenJoined: true });
    },
    playerInLobby() {
      if (!store.getState().startWhenJoined) return;
      store.setState({ startWhenJoined: false });
      void startGame();
    },
    stopPlaying() {
      store.setState({ playing: false, startWhenJoined: false });
    },
    retry: () => connect(0),
    dispose() {
      disposed = true;
      liveListeners.clear();
      dropConnection();
    },
  };
}
