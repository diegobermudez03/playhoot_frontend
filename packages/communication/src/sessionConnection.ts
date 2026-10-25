import type { CredentialProvider } from '@playhoot/app-core';
import {
  closeCodes,
  invalidGameDataReason,
  joinByCodePath,
  modeledPlayerServerMessageTypes,
  normalCloseReasons,
  playerBySessionPath,
  playerServerMessageSchema,
  type PlayerDevice,
  realtimeLimits,
  realtimeSubprotocol,
  tokenSubprotocolPrefix,
  commandOutcomes,
  type CommandOutcome,
  type GameFaultKind,
  type PlayerClientMessage,
  type PlayerServerMessage,
} from '@playhoot/protocol';

import { err, ok, type Result } from './result';
import { createViewTracker, type ViewUpdate } from './viewState';

// Which Session to connect to as a player: by join code (lobby only) or by Session UUID.
export type SessionTarget =
  { kind: 'joinCode'; joinCode: string } | { kind: 'session'; sessionUUID: string };

// Why a connection closed, as what the caller should do about it.
export type ConnectionCloseKind =
  // Closed before it opened. The handshake was refused (unknown/expired code, auth, limits,
  // Session not joinable) or the network failed: browsers do not expose which.
  | 'unreachable'
  // The Runtime ended it: the Session ended, the player left, another connection of the same
  // player replaced it (do not reconnect), or the player was disconnected.
  | 'session-ended'
  | 'left'
  | 'replaced'
  | 'disconnected'
  // Transport trouble or a server restart/owner change: reconnecting may work.
  | 'retryable'
  // The server judged a message from this client invalid or over a limit.
  | 'protocol'
  // The game sent data it does not declare; the backend recorded it and ended this player's
  // connection. Not the player's fault, and reconnecting would run the same game.
  | 'game-data-invalid';

export type SessionConnectionEvent =
  | { type: 'open' }
  // Lobby, start, rejection, end and leave messages. Views and command results arrive as
  // `view` events and as `command()` results instead.
  | {
      type: 'message';
      message: Exclude<PlayerServerMessage, { type: 'player_view' | 'command_result' }>;
    }
  // The player's state after a view, already reconciled (patches applied, gaps resynced).
  | { type: 'view'; update: ViewUpdate }
  // A SAMPLE left with this sequence: views acknowledge it in `ack` (prediction/reconciliation).
  | { type: 'sample-sent'; sequence: number }
  // A FULL view was asked for because a view was missed (observability).
  | { type: 'resync-requested' }
  | { type: 'protocol-error'; detail: string }
  | { type: 'closed'; kind: ConnectionCloseKind; code: number; reason: string };

export interface CommandResult {
  token: string;
  // `connection-closed`: no answer arrived before the connection ended; the same token can be
  // retried on the next connection without running the command twice. `too-large`: never sent.
  // `unknown`: an outcome this client does not know (the backend added one).
  outcome: CommandOutcome | 'unknown' | 'connection-closed' | 'too-large';
  response?: unknown;
}

export interface SessionConnection {
  subscribe(listener: (event: SessionConnectionEvent) => void): () => void;
  // Sends the player's full logical input snapshot. Calls faster than the server allows are
  // coalesced: only the latest snapshot is sent, which loses nothing.
  sample(inputs: Record<string, unknown>): void;
  // Runs a game command. Retries by itself, with the same token, while the server answers
  // `rate_limited`.
  command(
    name: string,
    payload?: Record<string, unknown> | null,
    options?: { token?: string },
  ): Promise<CommandResult>;
  // The player's current trustworthy state and its ack (the last sample sequence the backend
  // consumed), or undefined before the first FULL view and while a gap waits for one.
  currentView(): { state: unknown; ack: number } | undefined;
  // Asks for a FULL view. Gaps already trigger one; this is for the caller's own reasons.
  resync(): void;
  // Tells the backend the game frontend failed or misbehaved, for its audit. Never answered; a
  // detail over the server's limit is replaced by a note saying so. False when not sent.
  reportGameFault(kind: GameFaultKind, detail: Record<string, unknown>): boolean;
  // Asks to leave the Session. The server answers and closes the connection as `left`.
  leave(): void;
  // Closes the transport without leaving (navigating away). No event follows.
  close(): void;
}

export type ConnectFailure = { kind: 'no-credential' };

export interface SessionConnector {
  connect(target: SessionTarget): Result<SessionConnection, ConnectFailure>;
}

export interface Timers {
  now(): number;
  setTimeout(run: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface SessionConnectorOptions {
  // Base URL of the backend for WebSockets, e.g. `ws://localhost:5173` (`ws(s)://` + host).
  realtimeBaseUrl: string;
  credentials: CredentialProvider;
  // The kind of device joining, read for every connection (it can change between connections).
  device: () => PlayerDevice;
  WebSocket?: typeof WebSocket;
  timers?: Timers;
  newCommandToken?: () => string;
}

// Delays before resending a command the server answered `rate_limited`.
export const commandRetryDelaysMs = [250, 500, 1000] as const;

const minSampleIntervalMs = 1000 / realtimeLimits.samplesPerSecond;

const defaultTimers: Timers = {
  now: () => Date.now(),
  setTimeout: (run, delayMs) => globalThis.setTimeout(run, delayMs),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export function createSessionConnector(options: SessionConnectorOptions): SessionConnector {
  const Socket = options.WebSocket ?? globalThis.WebSocket;
  const timers = options.timers ?? defaultTimers;
  const newToken = options.newCommandToken ?? (() => globalThis.crypto.randomUUID());
  return {
    connect(target) {
      const token = options.credentials.currentToken();
      if (!token) return err({ kind: 'no-credential' });
      const path =
        target.kind === 'joinCode'
          ? joinByCodePath(target.joinCode, options.device())
          : playerBySessionPath(target.sessionUUID, options.device());
      const socket = new Socket(options.realtimeBaseUrl + path, [
        realtimeSubprotocol,
        tokenSubprotocolPrefix + base64UrlUnpadded(token),
      ]);
      return ok(wrap(socket, timers, newToken));
    },
  };
}

interface PendingCommand {
  message: Extract<PlayerClientMessage, { type: 'command' }>;
  attempt: number;
  resolve: (result: CommandResult) => void;
}

function wrap(socket: WebSocket, timers: Timers, newToken: () => string): SessionConnection {
  const listeners = new Set<(event: SessionConnectionEvent) => void>();
  const views = createViewTracker();
  const commands = new Map<string, PendingCommand>();
  const retryTimers = new Set<unknown>();
  let opened = false;
  let closed = false;
  let closedByClient = false;
  let resyncRequested = false;
  let lastAck = 0;
  let sequence = 0;
  let lastSampleAt = -Infinity;
  let pendingInputs: Record<string, unknown> | null = null;
  let sampleTimer: unknown = null;

  const emit = (event: SessionConnectionEvent) => {
    if (!closedByClient) listeners.forEach((listener) => listener(event));
  };

  const send = (message: PlayerClientMessage): boolean => {
    if (socket.readyState !== socket.OPEN) return false;
    socket.send(JSON.stringify(message));
    return true;
  };

  const flushSample = () => {
    sampleTimer = null;
    const inputs = pendingInputs;
    pendingInputs = null;
    if (!inputs || socket.readyState !== socket.OPEN) return;
    const message: PlayerClientMessage = { type: 'sample', sequence: sequence + 1, inputs };
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

  const onCommandResult = (
    token: string,
    outcome: CommandOutcome | 'unknown',
    response: unknown,
  ) => {
    const pending = commands.get(token);
    if (!pending) return;
    const delay = commandRetryDelaysMs[pending.attempt];
    if (outcome === 'rate_limited' && delay !== undefined) {
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
    pending.resolve(response === undefined ? { token, outcome } : { token, outcome, response });
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
    const decoded = decodeServerMessage(event.data);
    if (!decoded) return;
    if (decoded.type !== 'message') {
      emit(decoded);
      return;
    }
    const message = decoded.message;
    if (message.type === 'player_view') {
      const update = views.receive(message);
      lastAck = update.ack;
      if (update.kind === 'gap' && !resyncRequested) {
        resyncRequested = send({ type: 'resync' });
        if (resyncRequested) emit({ type: 'resync-requested' });
      }
      if (update.kind === 'state' && update.full) resyncRequested = false;
      emit({ type: 'view', update });
      return;
    }
    if (message.type === 'command_result') {
      onCommandResult(message.token, asCommandOutcome(message.outcome), message.response);
      return;
    }
    // A new start means a new baseline: the next view is FULL.
    if (message.type === 'session_started') resyncRequested = false;
    emit({ type: 'message', message });
  };
  socket.onclose = (event: CloseEvent) => {
    closed = true;
    if (sampleTimer !== null) timers.clearTimeout(sampleTimer);
    finishAllCommands();
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
      const message: PlayerClientMessage = {
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
      return state === undefined ? undefined : { state, ack: lastAck };
    },
    reportGameFault(kind, detail) {
      if (closed) return false;
      const fits =
        new TextEncoder().encode(JSON.stringify(detail)).length <=
        realtimeLimits.maxGameFaultDetailBytes;
      return send({ type: 'game_fault', kind, detail: fits ? detail : { truncated: true } });
    },
    resync() {
      send({ type: 'resync' });
    },
    leave: () => void send({ type: 'leave' }),
    close() {
      if (closed) return;
      closed = true;
      closedByClient = true;
      if (sampleTimer !== null) timers.clearTimeout(sampleTimer);
      finishAllCommands();
      listeners.clear();
      socket.close(closeCodes.normal);
    },
  };
}

// Decodes one text frame. A message type this client does not know is ignored (the server may
// add types); a known type that breaks its contract is a protocol error.
export function decodeServerMessage(
  text: string,
):
  | { type: 'message'; message: PlayerServerMessage }
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
  if (!modeledPlayerServerMessageTypes.has(type)) return null;
  const parsed = playerServerMessageSchema.safeParse(value);
  return parsed.success
    ? { type: 'message', message: parsed.data }
    : { type: 'protocol-error', detail: `invalid ${type} message` };
}

export function classifyClose(opened: boolean, code: number, reason: string): ConnectionCloseKind {
  if (!opened) return 'unreachable';
  switch (code) {
    case closeCodes.normal:
      switch (reason) {
        case normalCloseReasons.sessionEnded:
          return 'session-ended';
        case normalCloseReasons.left:
          return 'left';
        case normalCloseReasons.replaced:
          return 'replaced';
        default:
          return 'disconnected';
      }
    case closeCodes.invalidPayload:
      return reason === invalidGameDataReason ? 'game-data-invalid' : 'protocol';
    case closeCodes.unsupportedData:
    case closeCodes.policyViolation:
    case closeCodes.messageTooBig:
      return 'protocol';
    default:
      return 'retryable';
  }
}

function byteLength(message: PlayerClientMessage): number {
  return new TextEncoder().encode(JSON.stringify(message)).length;
}

function base64UrlUnpadded(text: string): string {
  let binary = '';
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function asCommandOutcome(outcome: string): CommandOutcome | 'unknown' {
  return (commandOutcomes as readonly string[]).includes(outcome)
    ? (outcome as CommandOutcome)
    : 'unknown';
}
