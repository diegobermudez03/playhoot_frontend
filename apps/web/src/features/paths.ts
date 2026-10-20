// Every shareable URL is composed here from backend identifiers (ADR-0002). Changing a path
// here is enough: the backend never knows frontend URLs.

// Where someone without a link types a join code.
export const enterCodePath = '/join';

export const joinPath = (joinCode: string) => `/join/${encodeURIComponent(joinCode)}`;

export const sessionPlayPath = (sessionUUID: string) =>
  `/sessions/${encodeURIComponent(sessionUUID)}/play`;
