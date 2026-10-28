// What the app keeps to call the backend as someone. Only the access token is sent; the rest
// renews it or drives UX.
export interface Credential {
  // The access token, sent with every request. Empty while a stored credential is being restored.
  token: string;
  // Renews `token` (backend IDENTITY-ADR-0003). Absent for the backend's development test accounts,
  // whose fixed token never expires.
  refreshToken?: string;
  // When `token` expires, in epoch milliseconds; absent when it does not.
  expiresAt?: number;
  userUUID: string;
  kind: 'guest' | 'account';
  // How the person is named, as the backend returned it (or chosen locally).
  displayName?: string;
}

// Platform persistence of the credential (browser storage on web, secure storage on mobile). A
// credential with a refresh token is stored without its access token, which lives in memory.
export interface CredentialStore {
  load(): Credential | null;
  save(credential: Credential): void;
  clear(): void;
}

// What renewing a credential ended in.
export type RefreshOutcome =
  | { kind: 'renewed'; credential: Credential }
  // The backend refused the refresh token: the credential is over.
  | { kind: 'invalid' }
  // The backend could not be reached or failed: the credential may still be good.
  | { kind: 'unavailable' };

// How the communication layer obtains the token to attach. Callers never pass tokens themselves.
export interface CredentialProvider {
  currentToken(): string | null;
  // Renews the credential after the backend refused its access token. Concurrent calls share one
  // renewal.
  refresh?(): Promise<RefreshOutcome['kind']>;
}

// Renews a credential with the backend, from its refresh token.
export interface CredentialRefresher {
  refresh(credential: Credential): Promise<RefreshOutcome>;
}

// For an app without an authentication backend: nothing renews, so a refused credential is over.
export const noCredentialRefresh: CredentialRefresher = {
  refresh: () => Promise.resolve({ kind: 'invalid' }),
};
