// What the app keeps to call the backend as someone. Only the token is sent; the rest drives UX.
export interface Credential {
  token: string;
  userUUID: string;
  kind: 'guest' | 'account';
  // The name the person chose, kept locally for UX. The backend does not return names yet.
  displayName?: string;
}

// Platform persistence of the credential (browser storage on web, secure storage on mobile).
export interface CredentialStore {
  load(): Credential | null;
  save(credential: Credential): void;
  clear(): void;
}

// How the communication layer obtains the token to attach. Callers never pass tokens themselves.
export interface CredentialProvider {
  currentToken(): string | null;
  // Tries to renew the credential after the backend refused it; true when a new token is ready.
  // Concurrent calls share one renewal.
  refresh?(): Promise<boolean>;
}

// Renews a credential with the backend (access token from a refresh token). Placeholder until
// authentication exists: `noCredentialRefresh` never renews, so a refused credential is forgotten.
export interface CredentialRefresher {
  refresh(credential: Credential): Promise<Credential | null>;
}

export const noCredentialRefresh: CredentialRefresher = {
  refresh: () => Promise.resolve(null),
};
