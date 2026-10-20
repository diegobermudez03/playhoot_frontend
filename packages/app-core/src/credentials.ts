// What the app keeps to call the backend as someone. Only the token is sent; the rest drives UX.
export interface Credential {
  token: string;
  userUUID: string;
  kind: 'guest' | 'account';
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
}
