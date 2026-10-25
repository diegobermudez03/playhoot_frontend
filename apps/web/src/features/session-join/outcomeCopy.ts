import type { JoinOutcome } from '@playhoot/feature-session-join';

import type { MessageId } from '../../i18n/catalogs';
import type { OwlMood } from '../../ui';

export type OutcomeAction = 'retry' | 'enter-code' | 'play-here';

// How the screen reacts: a problem shakes the owl, a farewell is calm, a celebration cheers.
export type OutcomeTone = 'problem' | 'farewell' | 'celebration';

export interface OutcomeCopy {
  title: MessageId;
  body: MessageId;
  mood: OwlMood;
  tone: OutcomeTone;
  // First action is the primary one.
  actions: OutcomeAction[];
}

export const outcomeActionLabels: Record<OutcomeAction, MessageId> = {
  retry: 'outcome.action.retry',
  'play-here': 'outcome.action.playHere',
  'enter-code': 'outcome.action.enterCode',
};

// What a person reads when a join is over (as message ids), and what they can do next.
export function outcomeCopy(outcome: JoinOutcome): OutcomeCopy {
  switch (outcome.kind) {
    case 'unreachable':
    case 'protocol-error':
      return unexpected;
    case 'rejected':
      return outcome.reason === 'device_not_supported'
        ? deviceCopy(outcome.requirements)
        : rejectedCopy(outcome.reason);
    case 'ended':
      return endedCopy(outcome.status, outcome.endCause, outcome.beforeStart);
    case 'replaced':
      return copy('replaced', 'surprised', ['play-here', 'enter-code']);
    case 'connection-lost':
      return copy('connectionLost', 'sleepy', ['retry', 'enter-code']);
    case 'left':
      return copy('left', 'sleepy', ['enter-code']);
    case 'game-stopped':
      return copy('gameStopped', 'surprised', ['enter-code']);
    case 'game-error':
      return copy('gameError', 'surprised', ['enter-code']);
  }
}

type OutcomeKey =
  | 'unexpected'
  | 'lobbyFull'
  | 'sessionStarted'
  | 'invalidCode'
  | 'invalidSession'
  | 'limitReached'
  | 'codeExpired'
  | 'cannotRejoin'
  | 'lobbyExpired'
  | 'hostClosedLobby'
  | 'hostEnded'
  | 'finished'
  | 'ended'
  | 'replaced'
  | 'connectionLost'
  | 'left'
  | 'gameStopped'
  | 'gameError'
  | 'deviceNeedsKeyboard'
  | 'deviceNeedsMouse'
  | 'deviceNotSupported';

const tones: Record<OutcomeKey, OutcomeTone> = {
  unexpected: 'problem',
  lobbyFull: 'problem',
  sessionStarted: 'problem',
  invalidCode: 'problem',
  invalidSession: 'problem',
  limitReached: 'farewell',
  codeExpired: 'problem',
  cannotRejoin: 'farewell',
  lobbyExpired: 'farewell',
  hostClosedLobby: 'farewell',
  hostEnded: 'farewell',
  finished: 'celebration',
  ended: 'farewell',
  replaced: 'problem',
  connectionLost: 'problem',
  left: 'farewell',
  gameStopped: 'problem',
  gameError: 'problem',
  deviceNeedsKeyboard: 'farewell',
  deviceNeedsMouse: 'farewell',
  deviceNotSupported: 'farewell',
};

function copy(key: OutcomeKey, mood: OwlMood, actions: OutcomeAction[]): OutcomeCopy {
  return {
    title: `outcome.${key}.title`,
    body: `outcome.${key}.body`,
    mood,
    tone: tones[key],
    actions,
  };
}

// What every failure without a case of its own shows: the handshake refused before it opened
// (network, auth, limits), a protocol error, and the rejections a player is not expected to meet.
const unexpected = copy('unexpected', 'surprised', ['retry', 'enter-code']);

// The device cannot play this game: say what it needs when the backend told us.
function deviceCopy(
  requirements: Extract<JoinOutcome, { kind: 'rejected' }>['requirements'],
): OutcomeCopy {
  if (requirements?.usesKeyboard) return copy('deviceNeedsKeyboard', 'sleepy', ['enter-code']);
  if (requirements?.usesPointerHover && requirements.usesPointerPress) {
    return copy('deviceNeedsMouse', 'sleepy', ['enter-code']);
  }
  return copy('deviceNotSupported', 'sleepy', ['enter-code']);
}

function rejectedCopy(reason: Extract<JoinOutcome, { kind: 'rejected' }>['reason']): OutcomeCopy {
  switch (reason) {
    case 'lobby_full':
      return copy('lobbyFull', 'surprised', ['enter-code', 'retry']);
    case 'session_started':
      return copy('sessionStarted', 'surprised', ['enter-code']);
    case 'invalid_join_code':
      return copy('invalidCode', 'surprised', ['enter-code']);
    case 'invalid_session':
      return copy('invalidSession', 'surprised', ['enter-code']);
    // A limit was reached: never an unexpected error, the person waits (decided by the human).
    case 'rate_limited':
    case 'too_many_connections':
    case 'server_busy':
      return copy('limitReached', 'sleepy', ['retry', 'enter-code']);
    // A lobby past its expiry that the backend has not closed yet (decided by the human).
    case 'session_unavailable':
      return copy('lobbyExpired', 'sleepy', ['enter-code']);
    case 'join_code_expired':
      return copy('codeExpired', 'sleepy', ['enter-code']);
    case 'participant_disconnected':
    case 'rejoin_rejected':
      return copy('cannotRejoin', 'sleepy', ['enter-code']);
    // Every other refusal (and an unknown one) is unexpected for the player.
    default:
      return unexpected;
  }
}

function endedCopy(status: string, endCause: string, beforeStart: boolean): OutcomeCopy {
  if (beforeStart) {
    return status === 'EXPIRED'
      ? copy('lobbyExpired', 'sleepy', ['enter-code'])
      : copy('hostClosedLobby', 'sleepy', ['enter-code']);
  }
  if (endCause === 'HOST_CANCELLED') return copy('hostEnded', 'sleepy', ['enter-code']);
  return status === 'FINISHED'
    ? copy('finished', 'happy', ['enter-code'])
    : copy('ended', 'sleepy', ['enter-code']);
}
