import type { AppState } from '@playhoot/app-core';
import type {
  ConnectionCloseKind,
  IdentityClient,
  SessionConnection,
  SessionConnector,
  SessionTarget,
} from '@playhoot/communication';
import {
  guestDisplayNameMaxLength,
  rateLimitedCode,
  rejectReasons,
  type PlayerServerMessage,
  type RejectReason,
} from '@playhoot/protocol';
import { createStore, type StoreApi } from 'zustand/vanilla';

export interface LobbyMember {
  userUUID: string;
  isYou: boolean;
}

export interface StartedSession {
  participantId: string;
  participants: { participantId: string; userUUID: string; isYou: boolean }[];
  frontend: { url: string; sha256: string; expiresAt: string };
}

// Why a name was not accepted. Presentation turns each into text in the person's language.
export type IdentityError =
  | { kind: 'invalid-name'; reason: 'empty' | 'too-long' | 'rejected'; maxLength: number }
  | { kind: 'rate-limited'; retryAfterSeconds: number | undefined }
  | { kind: 'unavailable' };

// Why the join is over. Each outcome maps to a message and a next action in presentation.
export type JoinOutcome =
  | { kind: 'rejected'; reason: RejectReason | 'unknown' }
  // The first handshake failed before the connection opened: wrong or expired code, a Session
  // that is not joinable, or the network. Browsers do not tell these apart.
  | { kind: 'unreachable' }
  | { kind: 'ended'; status: string; endCause: string; beforeStart: boolean }
  | { kind: 'left' }
  | { kind: 'replaced' }
  | { kind: 'connection-lost' }
  | { kind: 'protocol-error' };

export type JoinView =
  | { phase: 'identity'; submitting: boolean; error: IdentityError | null }
  | { phase: 'connecting'; reconnectAttempt: number }
  | { phase: 'lobby'; members: LobbyMember[] }
  | { phase: 'started'; session: StartedSession }
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
}

export interface JoinSession {
  store: StoreApi<JoinSessionState>;
  // Begins: asks for an identity when there is none, otherwise connects.
  start(): void;
  submitDisplayName(displayName: string): Promise<void>;
  // Starts over after a closed outcome.
  retry(): void;
  leave(): void;
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

  const setView = (view: JoinView) => store.setState({ view });
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
    setView({ phase: 'connecting', reconnectAttempt });
    const current = result.value;
    connection = current;
    let opened = false;
    current.subscribe((event) => {
      if (disposed || connection !== current) return;
      switch (event.type) {
        case 'open':
          opened = true;
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
          onClosed(event.kind, reconnectAttempt, opened);
          return;
      }
    });
  };

  const onMessage = (message: PlayerServerMessage) => {
    const me = myUserUUID();
    switch (message.type) {
      case 'lobby_update':
        store.setState({
          sessionUUID: message.session_uuid,
          view: {
            phase: 'lobby',
            members: message.members.map((m) => ({
              userUUID: m.user_uuid,
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
                isYou: p.participant_id === message.participant_id,
              })),
              frontend: {
                url: message.frontend.url,
                sha256: message.frontend.sha256,
                expiresAt: message.frontend.expires_at,
              },
            },
          },
        });
        return;
      case 'rejected':
        setView({
          phase: 'closed',
          outcome: { kind: 'rejected', reason: asRejectReason(message.reason) },
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
      case 'leave_result':
        return;
    }
  };

  const onClosed = (kind: ConnectionCloseKind, attempt: number, opened: boolean) => {
    const view = store.getState().view;
    // A rejection or a terminal message already decided the outcome.
    if (view.phase === 'closed') return;
    if (view.phase === 'leaving') {
      setView({ phase: 'closed', outcome: { kind: 'left' } });
      return;
    }
    switch (kind) {
      case 'left':
        setView({ phase: 'closed', outcome: { kind: 'left' } });
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
          setView({ phase: 'closed', outcome: { kind: 'connection-lost' } });
          return;
        }
        setView({ phase: 'connecting', reconnectAttempt: next });
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

  return {
    store,
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
      setView({ phase: 'identity', submitting: false, error });
    },
    retry: begin,
    leave() {
      if (connection && store.getState().view.phase !== 'closed') {
        setView({ phase: 'leaving' });
        connection.leave();
        return;
      }
      dropConnection();
      setView({ phase: 'closed', outcome: { kind: 'left' } });
    },
    dispose() {
      disposed = true;
      dropConnection();
    },
  };
}

function asRejectReason(reason: string): RejectReason | 'unknown' {
  return (rejectReasons as readonly string[]).includes(reason)
    ? (reason as RejectReason)
    : 'unknown';
}
