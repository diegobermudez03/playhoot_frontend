import type { AppState } from '@playhoot/app-core';
import type {
  CommandResult,
  ConnectionCloseKind,
  IdentityClient,
  SessionConnection,
  SessionConnectionEvent,
  SessionConnector,
  SessionTarget,
} from '@playhoot/communication';
import {
  guestDisplayNameMaxLength,
  presenceStatuses,
  rateLimitedCode,
  rejectReasons,
  type PlayerServerMessage,
  type PresenceStatus,
  type RejectReason,
} from '@playhoot/protocol';
import { createStore, type StoreApi } from 'zustand/vanilla';

export interface LobbyMember {
  userUUID: string;
  // How the backend's Identity names them; empty when it has no name.
  displayName: string;
  isYou: boolean;
}

export interface Participant {
  participantId: string;
  userUUID: string;
  displayName: string;
  isYou: boolean;
  // Whether they are playing, as the backend reports it during the game.
  status: PresenceStatus | 'unknown';
}

export interface StartedSession {
  participantId: string;
  participants: Participant[];
  frontend: {
    url: string;
    sha256: string;
    expiresAt: string;
    // The game's fixed shape: an aspect ratio and its logical resolution (plan §8).
    viewport: { aspectRatio: string; width: number; height: number };
    // The game's assets (ADR-0008), signed with the frontend: their URLs outlive the Session.
    assets: GameAsset[];
  };
}

// What a game uses, when the backend refused the device (`device_not_supported`).
export interface DeviceRequirements {
  usesKeyboard: boolean;
  usesPointerHover: boolean;
  usesPointerPress: boolean;
}

export interface GameAsset {
  key: string;
  type: string;
  mimeType: string;
  sha256: string;
  size: number;
  url: string;
}

// Why a name was not accepted. Presentation turns each into text in the person's language.
export type IdentityError =
  | { kind: 'invalid-name'; reason: 'empty' | 'too-long' | 'rejected'; maxLength: number }
  | { kind: 'rate-limited'; retryAfterSeconds: number | undefined }
  | { kind: 'unavailable' };

// Why the join is over. Each outcome maps to a message and a next action in presentation.
export type JoinOutcome =
  | { kind: 'rejected'; reason: RejectReason | 'unknown'; requirements?: DeviceRequirements }
  // The first handshake failed before the connection opened: the network, authorization, rate
  // limits or a busy server. Browsers do not tell these apart. A refused join code is `rejected`.
  | { kind: 'unreachable' }
  | { kind: 'ended'; status: string; endCause: string; beforeStart: boolean }
  | { kind: 'left' }
  // The player left because their device stopped the game for misbehaving (ADR-0006); the backend
  // was told why.
  | { kind: 'game-stopped' }
  // The game sent data it does not declare: the backend recorded it and ended this player's
  // connection. Never reconnected (it would run the same game).
  | { kind: 'game-error' }
  | { kind: 'replaced' }
  | { kind: 'connection-lost' }
  | { kind: 'protocol-error' };

export type JoinView =
  | { phase: 'identity'; submitting: boolean; error: IdentityError | null }
  | { phase: 'connecting'; reconnectAttempt: number }
  | { phase: 'lobby'; members: LobbyMember[] }
  // The game is running. While the connection is lost and being re-established the phase stays
  // `started` (the game is not torn down), with `connection: 'reconnecting'`.
  | { phase: 'started'; session: StartedSession; connection: 'connected' | 'reconnecting' }
  | { phase: 'leaving' }
  | { phase: 'closed'; outcome: JoinOutcome };

export interface JoinSessionState {
  // What the URL asked for.
  target: SessionTarget;
  // Known once the backend tells us (first lobby update or start). Drives the URL (ADR-0002).
  sessionUUID: string | null;
  view: JoinView;
}

export interface JoinSessionDeps {
  app: AppState;
  identity: IdentityClient;
  connector: SessionConnector;
  newIdempotencyKey: () => string;
  // Waits before reconnecting; returns a cancel function. Defaults to setTimeout.
  schedule?: (run: () => void, delayMs: number) => () => void;
  // Observability (plan §17): what happened to the join, for whatever sink the app wires.
  onTelemetry?: (event: JoinTelemetry) => void;
}

export type JoinTelemetry =
  // A live connection closed, as the connection classified it.
  | { type: 'connection-closed'; kind: ConnectionCloseKind }
  // A reconnection after a lost connection opened, or the last attempt failed.
  | { type: 'reconnected' }
  | { type: 'gave-up' }
  // The connection asked for a FULL view because it missed one.
  | { type: 'resync-requested' }
  // The join is over: every outcome, so the app can classify the errors among them.
  | { type: 'outcome'; outcome: JoinOutcome }
  // Creating the guest identity failed.
  | { type: 'identity-failed'; error: IdentityError };

// The player's connection as whoever plays the game needs it: it always talks to the current
// connection and survives reconnections. Each new connection announces itself with an `open` event.
export type LiveSession = Pick<
  SessionConnection,
  'subscribe' | 'sample' | 'command' | 'currentView' | 'reportGameFault'
>;

export interface JoinSession {
  store: StoreApi<JoinSessionState>;
  live: LiveSession;
  // Begins: asks for an identity when there is none, otherwise connects.
  start(): void;
  submitDisplayName(displayName: string): Promise<void>;
  // Starts over after a closed outcome.
  retry(): void;
  // Leaves the Session. `game-stopped`: because the game was stopped for misbehaving, which the
  // outcome then says instead of a plain leave.
  leave(reason?: 'game-stopped'): void;
  // Releases everything (route exit). Closes the connection without leaving.
  dispose(): void;
}

// Delays before each automatic reconnection attempt after the connection is lost.
export const reconnectDelaysMs = [1000, 2000, 4000] as const;

export function createJoinSession(target: SessionTarget, deps: JoinSessionDeps): JoinSession {
  const schedule =
    deps.schedule ??
    ((run, delayMs) => {
      const id = setTimeout(run, delayMs);
      return () => clearTimeout(id);
    });
  const store = createStore<JoinSessionState>(() => ({
    target,
    sessionUUID: target.kind === 'session' ? target.sessionUUID : null,
    view: { phase: 'connecting', reconnectAttempt: 0 },
  }));

  let connection: SessionConnection | null = null;
  let cancelReconnect: (() => void) | null = null;
  let disposed = false;
  // One idempotency key per submitted name, reused when the same name is submitted again.
  let pendingGuest: { displayName: string; key: string } | null = null;
  const liveListeners = new Set<(event: SessionConnectionEvent) => void>();

  const setView = (view: JoinView) => {
    store.setState({ view });
    if (view.phase === 'closed') deps.onTelemetry?.({ type: 'outcome', outcome: view.outcome });
  };
  const myUserUUID = () => {
    const auth = deps.app.store.getState().auth;
    return auth.status === 'guest' || auth.status === 'authenticated' ? auth.userUUID : null;
  };

  const dropConnection = () => {
    cancelReconnect?.();
    cancelReconnect = null;
    connection?.close();
    connection = null;
  };

  const connect = (reconnectAttempt: number) => {
    if (disposed) return;
    dropConnection();
    const sessionUUID = store.getState().sessionUUID;
    const result = deps.connector.connect(sessionUUID ? { kind: 'session', sessionUUID } : target);
    if (!result.ok) {
      setView({ phase: 'identity', submitting: false, error: null });
      return;
    }
    const view = store.getState().view;
    if (view.phase === 'started') setView({ ...view, connection: 'reconnecting' });
    else setView({ phase: 'connecting', reconnectAttempt });
    const current = result.value;
    connection = current;
    let opened = false;
    current.subscribe((event) => {
      if (disposed || connection !== current) return;
      if (event.type === 'open' || event.type === 'view' || event.type === 'sample-sent') {
        liveListeners.forEach((listener) => listener(event));
      }
      switch (event.type) {
        case 'open':
          opened = true;
          if (reconnectAttempt > 0) deps.onTelemetry?.({ type: 'reconnected' });
          return;
        case 'resync-requested':
          deps.onTelemetry?.({ type: 'resync-requested' });
          return;
        case 'message':
          onMessage(event.message);
          return;
        case 'protocol-error':
          dropConnection();
          setView({ phase: 'closed', outcome: { kind: 'protocol-error' } });
          return;
        case 'closed':
          connection = null;
          deps.onTelemetry?.({ type: 'connection-closed', kind: event.kind });
          onClosed(event.kind, reconnectAttempt, opened);
          return;
      }
    });
  };

  const onMessage = (message: PlayerServerMessage) => {
    const me = myUserUUID();
    // A player leaving while the game starts may still be told it started before the backend
    // applies the leave: the Session goes on without them, so it is not shown.
    if (
      store.getState().view.phase === 'leaving' &&
      (message.type === 'lobby_update' ||
        message.type === 'session_started' ||
        message.type === 'roster_update')
    )
      return;
    switch (message.type) {
      case 'lobby_update':
        store.setState({
          sessionUUID: message.session_uuid,
          view: {
            phase: 'lobby',
            members: message.members.map((m) => ({
              userUUID: m.user_uuid,
              displayName: m.display_name,
              isYou: m.user_uuid === me,
            })),
          },
        });
        return;
      case 'session_started':
        store.setState({
          sessionUUID: message.session_uuid,
          view: {
            phase: 'started',
            session: {
              participantId: message.participant_id,
              participants: message.participants.map((p) => ({
                participantId: p.participant_id,
                userUUID: p.user_uuid,
                displayName: p.display_name,
                isYou: p.participant_id === message.participant_id,
                status: 'active' as const,
              })),
              frontend: {
                url: message.frontend.url,
                sha256: message.frontend.sha256,
                expiresAt: message.frontend.expires_at,
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
            },
            connection: 'connected',
          },
        });
        return;
      case 'rejected':
        // A Session that already ended is shown like one that ends while connected.
        if (message.reason === 'session_ended') {
          const status = message.status ?? 'UNKNOWN';
          setView({
            phase: 'closed',
            outcome: {
              kind: 'ended',
              status,
              endCause: message.end_cause ?? 'UNKNOWN',
              beforeStart: status === 'EXPIRED',
            },
          });
          return;
        }
        setView({
          phase: 'closed',
          outcome: {
            kind: 'rejected',
            reason: asRejectReason(message.reason),
            ...(message.requirements && {
              requirements: {
                usesKeyboard: message.requirements.uses_keyboard === true,
                usesPointerHover: message.requirements.uses_pointer_hover === true,
                usesPointerPress: message.requirements.uses_pointer_press === true,
              },
            }),
          },
        });
        return;
      case 'session_ended':
      case 'lobby_closed':
        setView({
          phase: 'closed',
          outcome: {
            kind: 'ended',
            status: message.status,
            endCause: message.end_cause,
            beforeStart: message.type === 'lobby_closed',
          },
        });
        return;
      case 'roster_update': {
        const view = store.getState().view;
        if (view.phase !== 'started') return;
        const roster = new Map(message.members.map((m) => [m.participant_id, m]));
        setView({
          ...view,
          session: {
            ...view.session,
            participants: view.session.participants.map((p) => {
              const member = roster.get(p.participantId);
              return member
                ? { ...p, displayName: member.display_name, status: asPresence(member.status) }
                : p;
            }),
          },
        });
        return;
      }
      case 'leave_result':
        return;
    }
  };

  // What leaving ends in: a plain leave, or one forced by a stopped game.
  let leftOutcome: JoinOutcome = { kind: 'left' };

  const onClosed = (kind: ConnectionCloseKind, attempt: number, opened: boolean) => {
    const view = store.getState().view;
    // A rejection or a terminal message already decided the outcome.
    if (view.phase === 'closed') return;
    if (view.phase === 'leaving') {
      setView({ phase: 'closed', outcome: leftOutcome });
      return;
    }
    switch (kind) {
      case 'left':
        setView({ phase: 'closed', outcome: leftOutcome });
        return;
      case 'replaced':
        setView({ phase: 'closed', outcome: { kind: 'replaced' } });
        return;
      case 'session-ended':
        setView({
          phase: 'closed',
          outcome: {
            kind: 'ended',
            status: 'UNKNOWN',
            endCause: 'UNKNOWN',
            beforeStart: view.phase !== 'started',
          },
        });
        return;
      case 'protocol':
        setView({ phase: 'closed', outcome: { kind: 'protocol-error' } });
        return;
      case 'game-data-invalid':
        setView({ phase: 'closed', outcome: { kind: 'game-error' } });
        return;
      case 'unreachable':
      case 'retryable':
      case 'disconnected': {
        // The very first handshake failing means the target itself is not joinable.
        if (kind === 'unreachable' && attempt === 0) {
          setView({ phase: 'closed', outcome: { kind: 'unreachable' } });
          return;
        }
        // An opened connection that drops restarts the attempt count.
        const next = opened ? 1 : attempt + 1;
        const delay = reconnectDelaysMs[next - 1];
        if (delay === undefined) {
          deps.onTelemetry?.({ type: 'gave-up' });
          setView({ phase: 'closed', outcome: { kind: 'connection-lost' } });
          return;
        }
        if (view.phase === 'started') setView({ ...view, connection: 'reconnecting' });
        else setView({ phase: 'connecting', reconnectAttempt: next });
        cancelReconnect = schedule(() => {
          cancelReconnect = null;
          connect(next);
        }, delay);
        return;
      }
    }
  };

  const begin = () => {
    const auth = deps.app.store.getState().auth;
    if (auth.status === 'guest' || auth.status === 'authenticated') connect(0);
    else setView({ phase: 'identity', submitting: false, error: null });
  };

  const live: LiveSession = {
    subscribe(listener) {
      liveListeners.add(listener);
      return () => liveListeners.delete(listener);
    },
    sample: (inputs) => connection?.sample(inputs),
    command: (name, payload, options) =>
      connection
        ? connection.command(name, payload, options)
        : Promise.resolve<CommandResult>({
            token: options?.token ?? '',
            outcome: 'connection-closed',
          }),
    currentView: () => connection?.currentView(),
    reportGameFault: (kind, detail) => connection?.reportGameFault(kind, detail) ?? false,
  };

  return {
    store,
    live,
    start: begin,
    async submitDisplayName(raw) {
      const displayName = raw.trim();
      if (!displayName || [...displayName].length > guestDisplayNameMaxLength) {
        setView({
          phase: 'identity',
          submitting: false,
          error: {
            kind: 'invalid-name',
            reason: displayName ? 'too-long' : 'empty',
            maxLength: guestDisplayNameMaxLength,
          },
        });
        return;
      }
      if (pendingGuest?.displayName !== displayName) {
        pendingGuest = { displayName, key: deps.newIdempotencyKey() };
      }
      setView({ phase: 'identity', submitting: true, error: null });
      const result = await deps.identity.createGuest(displayName, pendingGuest.key);
      if (disposed) return;
      if (result.ok) {
        pendingGuest = null;
        deps.app.signIn({ ...result.value, kind: 'guest', displayName });
        connect(0);
        return;
      }
      const failure = result.error;
      const error: IdentityError =
        failure.kind === 'http' && failure.status === 400
          ? { kind: 'invalid-name', reason: 'rejected', maxLength: guestDisplayNameMaxLength }
          : failure.kind === 'http' && failure.code === rateLimitedCode
            ? { kind: 'rate-limited', retryAfterSeconds: failure.retryAfterSeconds }
            : { kind: 'unavailable' };
      deps.onTelemetry?.({ type: 'identity-failed', error });
      setView({ phase: 'identity', submitting: false, error });
    },
    retry: begin,
    leave(reason) {
      leftOutcome = reason === 'game-stopped' ? { kind: 'game-stopped' } : { kind: 'left' };
      if (connection && store.getState().view.phase !== 'closed') {
        setView({ phase: 'leaving' });
        connection.leave();
        return;
      }
      dropConnection();
      setView({ phase: 'closed', outcome: leftOutcome });
    },
    dispose() {
      disposed = true;
      liveListeners.clear();
      dropConnection();
    },
  };
}

function asPresence(status: string): PresenceStatus | 'unknown' {
  return (presenceStatuses as readonly string[]).includes(status)
    ? (status as PresenceStatus)
    : 'unknown';
}

function asRejectReason(reason: string): RejectReason | 'unknown' {
  return (rejectReasons as readonly string[]).includes(reason)
    ? (reason as RejectReason)
    : 'unknown';
}
