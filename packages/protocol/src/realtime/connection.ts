// How a client opens a live Session connection (backend `api/play/handler.go`,
// `api/internal/wsx/wsx.go`, `api/internal/auth/auth.go`).

export const realtimeSubprotocol = 'playhoot.v1';

// Browsers cannot set headers on a WebSocket, so the token travels as a subprotocol:
// this prefix followed by the unpadded base64url of the token. The server never echoes it.
export const tokenSubprotocolPrefix = 'base64url.bearer.authorization.playhoot.';

// What kind of device a player joins from (backend SESSION ADR on device requirements): a desktop
// has a keyboard and a mouse; a mobile device only touch. The backend checks it against the game
// version's requirements on every player connection.
export const playerDevices = ['desktop', 'mobile'] as const;
export type PlayerDevice = (typeof playerDevices)[number];

export function joinByCodePath(joinCode: string, device: PlayerDevice): string {
  return `/v1/play/join/${encodeURIComponent(joinCode)}?device=${device}`;
}

export function playerBySessionPath(sessionUUID: string, device: PlayerDevice): string {
  return `/v1/play/join/sessions/${encodeURIComponent(sessionUUID)}/player?device=${device}`;
}

// Join codes: 6 characters from this alphabet, matched case-insensitively by the backend.
export const joinCodeAlphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const joinCodeLength = 6;

// Close codes the backend uses (BACKEND_CONTRACT.md "Close codes").
export const closeCodes = {
  normal: 1000,
  goingAway: 1001,
  unsupportedData: 1003,
  abnormal: 1006,
  invalidPayload: 1007,
  policyViolation: 1008,
  messageTooBig: 1009,
  internalError: 1011,
  serviceRestart: 1012,
} as const;

// Reasons of a 1000 close: why the Runtime ended this connection.
// The reason of a 1007 close when the game's frontend sent data its game does not declare (an
// invalid SAMPLE or COMMAND): the backend recorded it against the game and ended this player's
// connection. Any other 1007 is a malformed message from the client itself.
export const invalidGameDataReason = 'invalid_game_data';

export const normalCloseReasons = {
  sessionEnded: 'session_ended',
  disconnected: 'disconnected',
  left: 'left',
  replaced: 'replaced',
} as const;

// The creator's admin connection to their Session (lobby, start, cancel, watching players).
export function adminBySessionPath(sessionUUID: string): string {
  return `/v1/play/join/sessions/${encodeURIComponent(sessionUUID)}/admin`;
}
