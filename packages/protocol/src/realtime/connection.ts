// How a client opens a live Session connection (backend `api/play/handler.go`,
// `api/internal/wsx/wsx.go`, `api/internal/auth/auth.go`).

export const realtimeSubprotocol = 'playhoot.v1';

// Browsers cannot set headers on a WebSocket, so the token travels as a subprotocol:
// this prefix followed by the unpadded base64url of the token. The server never echoes it.
export const tokenSubprotocolPrefix = 'base64url.bearer.authorization.playhoot.';

export function joinByCodePath(joinCode: string): string {
  return `/v1/play/join/${encodeURIComponent(joinCode)}`;
}

export function playerBySessionPath(sessionUUID: string): string {
  return `/v1/play/join/sessions/${encodeURIComponent(sessionUUID)}/player`;
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
export const normalCloseReasons = {
  sessionEnded: 'session_ended',
  disconnected: 'disconnected',
  left: 'left',
  replaced: 'replaced',
} as const;
