import type { CredentialProvider } from '@playhoot/app-core';
import {
  adminBySessionPath,
  adminServerMessageSchema,
  cancelSessionOutcomes,
  closeCodes,
  modeledAdminServerMessageTypes,
  realtimeSubprotocol,
  selectPerspectiveOutcomes,
  startSessionOutcomes,
  tokenSubprotocolPrefix,
  type AdminClientMessage,
  type AdminServerMessage,
  type CancelSessionOutcome,
  type SelectPerspectiveOutcome,
  type StartSessionOutcome,
} from '@playhoot/protocol';

import { err, ok, type Result } from './result';
import {
  base64UrlUnpadded,
  classifyClose,
  type ConnectFailure,
  type ConnectionCloseKind,
} from './sessionConnection';
import { createViewTracker, type ViewUpdate } from './viewState';

type AnswerType = 'start_session_result' | 'cancel_session_result' | 'select_perspective_result';

export type AdminConnectionEvent =
  | { type: 'open' }
  // Lobby, start, rejection and end messages. Views and answers arrive as `view` events and as the
  // results of the requests instead.
  | { type: 'message'; message: Exclude<AdminServerMessage, { type: 'player_view' | AnswerType }> }
  // The watched participant's state after a view, reconciled (patches applied, gaps resynced). An
  // admin view has no ack: `update.ack` is always 0.
  | { type: 'view'; participantId: string; update: ViewUpdate }
  | { type: 'resync-requested' }
  | { type: 'protocol-error'; detail: string }
  | { type: 'closed'; kind: ConnectionCloseKind; code: number; reason: string };

// What a request ended in: the backend's outcome, one this client does not know (`unknown`), or no
// answer because the connection ended (`connection-closed`).
export type AdminAnswer<T extends string> = T | 'unknown' | 'connection-closed';

export interface AdminConnection {
  subscribe(listener: (event: AdminConnectionEvent) => void): () => void;
  startSession(): Promise<AdminAnswer<StartSessionOutcome>>;
  cancelSession(): Promise<AdminAnswer<CancelSessionOutcome>>;
  // Watches one participant: a FULL view of theirs follows `selected`.
  selectPerspective(participantId: string): Promise<AdminAnswer<SelectPerspectiveOutcome>>;
  // The watched participant's current trustworthy state, or undefined (none watched yet, or a gap).
  currentView(): { participantId: string; state: unknown } | undefined;
  // Closes the transport (navigating away). No event follows. The Session is not affected.
  close(): void;
}

export interface AdminConnector {
  connect(sessionUUID: string): Result<AdminConnection, ConnectFailure>;
}

export interface AdminConnectorOptions {
  realtimeBaseUrl: string;
  credentials: CredentialProvider;
  WebSocket?: typeof WebSocket;
}

// The creator's live connection to their Session: lobby updates, start, cancel and the views of
// the participant they watch.
export function createAdminConnector(options: AdminConnectorOptions): AdminConnector {
  const Socket = options.WebSocket ?? globalThis.WebSocket;
  return {
    connect(sessionUUID) {
      const token = options.credentials.currentToken();
      if (!token) return err({ kind: 'no-credential' });
      const socket = new Socket(options.realtimeBaseUrl + adminBySessionPath(sessionUUID), [
        realtimeSubprotocol,
        tokenSubprotocolPrefix + base64UrlUnpadded(token),
      ]);
      return ok(wrap(socket));
    },
  };
}

function wrap(socket: WebSocket): AdminConnection {
  const listeners = new Set<(event: AdminConnectionEvent) => void>();
  // The backend answers each kind of request in order, so answers match pending requests in order.
  // `null`: the connection ended before the answer.
  const pending: Record<AnswerType, ((outcome: string | null) => void)[]> = {
    start_session_result: [],
    cancel_session_result: [],
    select_perspective_result: [],
  };
  let views = createViewTracker();
  let watched: string | null = null;
  let opened = false;
  let closed = false;
  let closedByClient = false;
  let resyncRequested = false;

  const emit = (event: AdminConnectionEvent) => {
    if (!closedByClient) listeners.forEach((listener) => listener(event));
  };
  const send = (message: AdminClientMessage): boolean => {
    if (socket.readyState !== socket.OPEN) return false;
    socket.send(JSON.stringify(message));
    return true;
  };
  const request = <T extends string>(
    answer: AnswerType,
    message: AdminClientMessage,
    known: readonly T[],
  ): Promise<AdminAnswer<T>> =>
    new Promise((resolve) => {
      if (closed || !send(message)) {
        resolve('connection-closed');
        return;
      }
      pending[answer].push((outcome) =>
        resolve(
          outcome === null
            ? 'connection-closed'
            : (known as readonly string[]).includes(outcome)
              ? (outcome as T)
              : 'unknown',
        ),
      );
    });
  const finishPending = () => {
    for (const queue of Object.values(pending)) {
      queue.splice(0).forEach((resolve) => resolve(null));
    }
  };

  socket.onopen = () => {
    opened = true;
    emit({ type: 'open' });
  };
  socket.onmessage = (event: MessageEvent) => {
    if (typeof event.data !== 'string') {
      emit({ type: 'protocol-error', detail: 'binary frame' });
      return;
    }
    const decoded = decodeAdminMessage(event.data);
    if (!decoded) return;
    if (decoded.type === 'protocol-error') {
      emit(decoded);
      return;
    }
    const message = decoded.message;
    switch (message.type) {
      case 'player_view': {
        // Another participant starts a new baseline.
        if (message.participant_id !== watched) {
          watched = message.participant_id;
          views = createViewTracker();
        }
        const update = views.receive({ ...message, consumed_through_sample_sequence: 0 });
        if (update.kind === 'gap' && !resyncRequested) {
          resyncRequested = send({ type: 'resync' });
          if (resyncRequested) emit({ type: 'resync-requested' });
        }
        if (update.kind === 'state' && update.full) resyncRequested = false;
        emit({ type: 'view', participantId: message.participant_id, update });
        return;
      }
      case 'start_session_result':
      case 'cancel_session_result':
      case 'select_perspective_result':
        pending[message.type].shift()?.(message.outcome);
        return;
      default:
        emit({ type: 'message', message });
    }
  };
  socket.onclose = (event: CloseEvent) => {
    closed = true;
    finishPending();
    emit({
      type: 'closed',
      kind: classifyClose(opened, event.code, event.reason),
      code: event.code,
      reason: event.reason,
    });
    listeners.clear();
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    startSession: () =>
      request('start_session_result', { type: 'start_session' }, startSessionOutcomes),
    cancelSession: () =>
      request('cancel_session_result', { type: 'cancel_session' }, cancelSessionOutcomes),
    selectPerspective: (participantId) =>
      request(
        'select_perspective_result',
        { type: 'select_perspective', participant_id: participantId },
        selectPerspectiveOutcomes,
      ),
    currentView() {
      const state = views.state;
      return watched === null || state === undefined
        ? undefined
        : { participantId: watched, state };
    },
    close() {
      if (closed) return;
      closed = true;
      closedByClient = true;
      finishPending();
      listeners.clear();
      socket.close(closeCodes.normal);
    },
  };
}

// Decodes one text frame of the admin connection. Unknown types are ignored; a known type that
// breaks its contract is a protocol error.
export function decodeAdminMessage(
  text: string,
):
  | { type: 'message'; message: AdminServerMessage }
  | { type: 'protocol-error'; detail: string }
  | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { type: 'protocol-error', detail: 'invalid JSON' };
  }
  const type = (value as { type?: unknown } | null)?.type;
  if (typeof type !== 'string') return { type: 'protocol-error', detail: 'message without type' };
  if (!modeledAdminServerMessageTypes.has(type)) return null;
  const parsed = adminServerMessageSchema.safeParse(value);
  return parsed.success
    ? { type: 'message', message: parsed.data }
    : { type: 'protocol-error', detail: `invalid ${type} message` };
}
