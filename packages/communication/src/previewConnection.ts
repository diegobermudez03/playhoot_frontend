import type { CredentialProvider } from '@playhoot/app-core';
import {
  closeCodes,
  commandOutcomes,
  modeledPreviewServerMessageTypes,
  normalCloseReasons,
  previewConnectPath,
  previewServerMessageSchema,
  realtimeLimits,
  realtimeSubprotocol,
  tokenSubprotocolPrefix,
  type CommandOutcome,
  type PreviewClientMessage,
  type PreviewServerMessage,
} from '@playhoot/protocol';

import { err, ok, type Result } from './result';
import {
  base64UrlUnpadded,
  commandRetryDelaysMs,
  type CommandResult,
  type ConnectFailure,
  type Timers,
} from './sessionConnection';
import { createViewTracker, type ViewUpdate } from './viewState';

// Why a preview connection closed, as what the caller should do about it.
export type PreviewCloseKind =
  // Closed before it opened: refused (unknown preview, not the owner, auth) or the network failed.
  | 'unreachable'
  // The backend ended the preview (`preview_ended` came first with the reason).
  | 'ended'
  // The creator opened another preview, or another connection to this one.
  | 'replaced'
  // Transport trouble or a server restart: reconnecting may work while the preview lives.
  | 'retryable'
  // The server judged a message from this client invalid or over a limit.
  | 'protocol';

export type PreviewConnectionEvent =
  | { type: 'open' }
  // Start, participant switch, pause, resume, end, error and refusal messages. Views and command
  // results arrive as `view` events and as `command()` results instead.
  | {
      type: 'message';
      message: Exclude<PreviewServerMessage, { type: 'player_view' | 'command_result' }>;
    }
  // The acted-as participant's state after a view, reconciled (patches applied, gaps resynced).
  | { type: 'view'; participantId: string; update: ViewUpdate }
  | { type: 'sample-sent'; sequence: number }
  | { type: 'resync-requested' }
  | { type: 'protocol-error'; detail: string }
  | { type: 'closed'; kind: PreviewCloseKind; code: number; reason: string };

export interface PreviewConnection {
  subscribe(listener: (event: PreviewConnectionEvent) => void): () => void;
  // The participant the views are of, as the backend last confirmed (`preview_started`,
  // `acting_as`); null before the start.
  readonly actingAs: string | null;
  // Plays as another participant from now on: inputs held for the previous one are dropped and
  // sample sequences start again at 1. Its FULL view follows `acting_as`.
  actAs(participantId: string): boolean;
  // The acted-as participant's full input snapshot, coalesced like a player's.
  sample(inputs: Record<string, unknown>): void;
  command(
    name: string,
    payload?: Record<string, unknown> | null,
    options?: { token?: string },
  ): Promise<CommandResult>;
  // The acted-as participant's trustworthy state and ack, or undefined (no FULL view yet, a gap).
  currentView(): { participantId: string; state: unknown; ack: number } | undefined;
  resync(): void;
  pause(): boolean;
  resume(): boolean;
  // Ends the preview: `preview_ended` (ended_by_owner) and the close follow.
  end(): boolean;
  // Closes the transport (navigating away). No event follows; the preview ends when idle.
  close(): void;
}

export interface PreviewConnector {
  connect(previewUUID: string): Result<PreviewConnection, ConnectFailure>;
}

export interface PreviewConnectorOptions {
  realtimeBaseUrl: string;
  credentials: CredentialProvider;
  WebSocket?: typeof WebSocket;
  timers?: Timers;
  newCommandToken?: () => string;
}

const minSampleIntervalMs = 1000 / realtimeLimits.samplesPerSecond;

const defaultTimers: Timers = {
  now: () => Date.now(),
  setTimeout: (run, delayMs) => globalThis.setTimeout(run, delayMs),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

// The creator's live connection to a preview of their draft.
export function createPreviewConnector(options: PreviewConnectorOptions): PreviewConnector {
  const Socket = options.WebSocket ?? globalThis.WebSocket;
  const timers = options.timers ?? defaultTimers;
  const newToken = options.newCommandToken ?? (() => globalThis.crypto.randomUUID());
  return {
    connect(previewUUID) {
      const token = options.credentials.currentToken();
      if (!token) return err({ kind: 'no-credential' });
      const socket = new Socket(options.realtimeBaseUrl + previewConnectPath(previewUUID), [
        realtimeSubprotocol,
        tokenSubprotocolPrefix + base64UrlUnpadded(token),
      ]);
      return ok(wrap(socket, timers, newToken));
    },
  };
}

interface PendingCommand {
  message: Extract<PreviewClientMessage, { type: 'command' }>;
  attempt: number;
  resolve: (result: CommandResult) => void;
}

function wrap(socket: WebSocket, timers: Timers, newToken: () => string): PreviewConnection {
  const listeners = new Set<(event: PreviewConnectionEvent) => void>();
  let views = createViewTracker();
  const commands = new Map<string, PendingCommand>();
  const retryTimers = new Set<unknown>();
  let actingAs: string | null = null;
  let opened = false;
  let closed = false;
  let closedByClient = false;
  let resyncRequested = false;
  let lastAck = 0;
  let sequence = 0;
  let lastSampleAt = -Infinity;
  let pendingInputs: Record<string, unknown> | null = null;
  let sampleTimer: unknown = null;

  const emit = (event: PreviewConnectionEvent) => {
    if (!closedByClient) listeners.forEach((listener) => listener(event));
  };
  const send = (message: PreviewClientMessage): boolean => {
    if (socket.readyState !== socket.OPEN) return false;
    socket.send(JSON.stringify(message));
    return true;
  };
  const dropPendingSample = () => {
    if (sampleTimer !== null) timers.clearTimeout(sampleTimer);
    sampleTimer = null;
    pendingInputs = null;
  };
  // A new participant (or start) is a new baseline: views and acks start over.
  const beginActing = (participantId: string) => {
    actingAs = participantId;
    views = createViewTracker();
    resyncRequested = false;
    lastAck = 0;
  };

  const flushSample = () => {
    sampleTimer = null;
    const inputs = pendingInputs;
    pendingInputs = null;
    if (!inputs || socket.readyState !== socket.OPEN) return;
    const message: PreviewClientMessage = { type: 'sample', sequence: sequence + 1, inputs };
    if (byteLength(message) > realtimeLimits.maxMessageBytes) {
      emit({ type: 'protocol-error', detail: 'sample over the message size limit, not sent' });
      return;
    }
    sequence += 1;
    lastSampleAt = timers.now();
    send(message);
    emit({ type: 'sample-sent', sequence });
  };

  const finishAllCommands = () => {
    retryTimers.forEach((handle) => timers.clearTimeout(handle));
    retryTimers.clear();
    for (const [token, pending] of commands)
      pending.resolve({ token, outcome: 'connection-closed' });
    commands.clear();
  };

  const onCommandResult = (token: string, outcome: string, response: unknown) => {
    const pending = commands.get(token);
    if (!pending) return;
    const known = (commandOutcomes as readonly string[]).includes(outcome)
      ? (outcome as CommandOutcome)
      : 'unknown';
    const delay = commandRetryDelaysMs[pending.attempt];
    if (known === 'rate_limited' && delay !== undefined) {
      pending.attempt += 1;
      const handle = timers.setTimeout(() => {
        retryTimers.delete(handle);
        if (!send(pending.message)) {
          commands.delete(token);
          pending.resolve({ token, outcome: 'connection-closed' });
        }
      }, delay);
      retryTimers.add(handle);
      return;
    }
    commands.delete(token);
    pending.resolve(
      response === undefined ? { token, outcome: known } : { token, outcome: known, response },
    );
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
    const decoded = decodePreviewMessage(event.data);
    if (!decoded) return;
    if (decoded.type === 'protocol-error') {
      emit(decoded);
      return;
    }
    const message = decoded.message;
    switch (message.type) {
      case 'player_view': {
        // A view of a participant no longer acted as (sent before the switch) is stale.
        if (message.participant_id !== actingAs) return;
        const update = views.receive(message);
        lastAck = update.ack;
        if (update.kind === 'gap' && !resyncRequested) {
          resyncRequested = send({ type: 'resync' });
          if (resyncRequested) emit({ type: 'resync-requested' });
        }
        if (update.kind === 'state' && update.full) resyncRequested = false;
        emit({ type: 'view', participantId: message.participant_id, update });
        return;
      }
      case 'command_result':
        onCommandResult(message.token, message.outcome, message.response);
        return;
      case 'preview_started':
        beginActing(message.acting_as);
        break;
      case 'acting_as':
        beginActing(message.participant_id);
        break;
      case 'error': {
        // The command the game does not declare is answered here, not by a command_result.
        const pending = message.token === undefined ? undefined : commands.get(message.token);
        if (message.token !== undefined && pending) {
          commands.delete(message.token);
          pending.resolve({ token: message.token, outcome: 'invalid' });
        }
        break;
      }
    }
    emit({ type: 'message', message });
  };
  socket.onclose = (event: CloseEvent) => {
    closed = true;
    dropPendingSample();
    finishAllCommands();
    emit({
      type: 'closed',
      kind: classifyPreviewClose(opened, event.code, event.reason),
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
    get actingAs() {
      return actingAs;
    },
    actAs(participantId) {
      if (closed) return false;
      dropPendingSample();
      if (!send({ type: 'act_as', participant_id: participantId })) return false;
      sequence = 0;
      lastSampleAt = -Infinity;
      return true;
    },
    sample(inputs) {
      if (closed) return;
      pendingInputs = inputs;
      if (sampleTimer !== null) return;
      const wait = lastSampleAt + minSampleIntervalMs - timers.now();
      if (wait <= 0) flushSample();
      else sampleTimer = timers.setTimeout(flushSample, wait);
    },
    command(name, payload, options) {
      const token = options?.token ?? newToken();
      const message: PreviewClientMessage = {
        type: 'command',
        token,
        name,
        ...(payload !== undefined && { payload }),
      };
      if (
        token.length > realtimeLimits.maxCommandTokenLength ||
        byteLength(message) > realtimeLimits.maxMessageBytes
      ) {
        return Promise.resolve({ token, outcome: 'too-large' });
      }
      return new Promise<CommandResult>((resolve) => {
        if (closed || !send(message)) {
          resolve({ token, outcome: 'connection-closed' });
          return;
        }
        commands.set(token, { message, attempt: 0, resolve });
      });
    },
    currentView() {
      const state = views.state;
      return actingAs === null || state === undefined
        ? undefined
        : { participantId: actingAs, state, ack: lastAck };
    },
    resync: () => void send({ type: 'resync' }),
    pause: () => !closed && send({ type: 'pause' }),
    resume: () => !closed && send({ type: 'resume' }),
    end: () => !closed && send({ type: 'end' }),
    close() {
      if (closed) return;
      closed = true;
      closedByClient = true;
      dropPendingSample();
      finishAllCommands();
      listeners.clear();
      socket.close(closeCodes.normal);
    },
  };
}

// Decodes one text frame of a preview connection. Unknown types are ignored; a known type that
// breaks its contract is a protocol error.
export function decodePreviewMessage(
  text: string,
):
  | { type: 'message'; message: PreviewServerMessage }
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
  if (!modeledPreviewServerMessageTypes.has(type)) return null;
  const parsed = previewServerMessageSchema.safeParse(value);
  return parsed.success
    ? { type: 'message', message: parsed.data }
    : { type: 'protocol-error', detail: `invalid ${type} message` };
}

export function classifyPreviewClose(
  opened: boolean,
  code: number,
  reason: string,
): PreviewCloseKind {
  if (!opened) return 'unreachable';
  switch (code) {
    case closeCodes.normal:
      return reason === normalCloseReasons.replaced ? 'replaced' : 'ended';
    case closeCodes.invalidPayload:
    case closeCodes.unsupportedData:
    case closeCodes.policyViolation:
    case closeCodes.messageTooBig:
      return 'protocol';
    default:
      return 'retryable';
  }
}

function byteLength(message: PreviewClientMessage): number {
  return new TextEncoder().encode(JSON.stringify(message)).length;
}
