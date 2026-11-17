import {
  deleteIdentityPath,
  deleteIdentityResponseSchema,
  invalidLanguageCode,
  invalidModeCode,
  myDataPath,
  myDataResponseSchema,
  notAnAccountCode,
  rateLimitedCode,
  setLanguagePath,
  setLanguageResponseSchema,
  setModePath,
  setModeResponseSchema,
  type MyDataResponse,
  type SetLanguageRequest,
  type SetModeRequest,
  type SignInMethodResponse,
} from '@playhoot/protocol';

import type { HttpClient, HttpFailure } from './http';
import { err, ok, type Result } from './result';

// The caller's own data and the two settings only they decide (backend `api/me`). The read is
// composed: the profile is Identity's, the declaration Compliance's and the limits the plan's,
// and either of the last two can be missing because its domain could not be asked.

// One way into the account, as the backend keeps it.
export interface SignInMethod {
  methodID: string;
  // `google`, `email`, `local`, or another the backend may add.
  issuer: string;
  // The address the method observed; empty when the provider gave none.
  address: string;
  name: string;
  addedAt: string;
}

export interface MyProfile {
  userUUID: string;
  displayName: string;
  // `guest` or `account`; the backend may add values.
  level: string;
  // `normal` or `teacher`; a value this build does not know reads as normal.
  mode: string;
  // Empty while the account has chosen no interface language.
  language: string;
  methods: SignInMethod[];
}

// What the caller declared, as declared — never as verified (P19§1).
export interface MyDeclaration {
  country: string;
  subdivision: string;
  meetsAge: boolean;
  thresholdAge: number;
  declaredAt: string;
}

export interface MyLimits {
  savedGames: number;
  creationsPerWindow: number;
  sessionsPerWindow: number;
  windowDays: number;
  playersPerSession: number;
  simultaneousRooms: number;
  storageMB: number;
}

export interface MyData {
  profile: MyProfile;
  // False when the declaration could not be read at all: the screen then says it is unknown
  // rather than that there is none.
  declarationKnown: boolean;
  declaration: MyDeclaration | null;
  limitsKnown: boolean;
  limits: MyLimits | null;
}

// The access token a mode switch answers. It carries the new mode; the session itself (the
// refresh token the client holds) is untouched (D-040).
export interface ReissuedAccess {
  token: string;
  // On this device's clock, from the lifetime the backend sent.
  expiresAt: number | undefined;
  // The mode this token was issued for.
  mode: string;
}

export type MeFailure =
  // Nobody is signed in, or the credential no longer stands for anyone.
  | { kind: 'unauthenticated' }
  // A guest asked for something only an account decides (a mode, an interface language).
  | { kind: 'not-account' }
  // The value names no mode, or no language this backend writes in.
  | { kind: 'invalid' }
  | { kind: 'rate-limited'; retryAfterSeconds: number | undefined }
  | { kind: 'unavailable'; failure: HttpFailure };

export interface MeClient {
  readMyData(): Promise<Result<MyData, MeFailure>>;
  // Switches the account's mode and answers the fresh access token carrying it.
  setMode(mode: string): Promise<Result<{ mode: string; access: ReissuedAccess }, MeFailure>>;
  // Stores the language the account reads Playhoot in, so its emails follow it (es, en or pt).
  setLanguage(language: string): Promise<Result<string, MeFailure>>;
  // Ends the caller's own identity. When this answers, the credentials it was sent with have
  // already stopped working.
  deleteIdentity(): Promise<Result<void, MeFailure>>;
}

// `now` is the client's clock, which a reissued token's lifetime is measured on.
export function createMeClient(http: HttpClient, now: () => number = Date.now): MeClient {
  return {
    async readMyData() {
      const result = await http.request({
        method: 'GET',
        path: myDataPath,
        response: myDataResponseSchema,
      });
      return result.ok ? ok(toMyData(result.value)) : err(meFailure(result.error));
    },

    async setMode(mode) {
      const body: SetModeRequest = { mode };
      const result = await http.request({
        method: 'PUT',
        path: setModePath,
        body,
        response: setModeResponseSchema,
      });
      if (!result.ok) return err(meFailure(result.error));
      const answered = result.value;
      const expiresAt =
        answered.access_expires_in !== undefined
          ? now() + answered.access_expires_in * 1000
          : Date.parse(answered.access_expires_at);
      return ok({
        mode: answered.mode,
        access: {
          token: answered.access_token,
          expiresAt: Number.isFinite(expiresAt) ? expiresAt : undefined,
          mode: answered.mode,
        },
      });
    },

    async setLanguage(language) {
      const body: SetLanguageRequest = { language };
      const result = await http.request({
        method: 'PUT',
        path: setLanguagePath,
        body,
        response: setLanguageResponseSchema,
      });
      return result.ok ? ok(result.value.language) : err(meFailure(result.error));
    },

    async deleteIdentity() {
      const result = await http.request({
        method: 'POST',
        path: deleteIdentityPath,
        response: deleteIdentityResponseSchema,
      });
      return result.ok ? ok(undefined) : err(meFailure(result.error));
    },
  };
}

export function toSignInMethod(method: SignInMethodResponse): SignInMethod {
  return {
    methodID: method.method_id,
    issuer: method.issuer,
    address: method.address,
    name: method.name,
    addedAt: method.added_at,
  };
}

function toMyData(response: MyDataResponse): MyData {
  const declaration = response.declaration;
  const limits = response.limits;
  return {
    profile: {
      userUUID: response.profile.user_uuid,
      displayName: response.profile.display_name,
      level: response.profile.level,
      mode: response.profile.mode,
      language: response.profile.language,
      methods: response.profile.methods.map(toSignInMethod),
    },
    declarationKnown: response.declaration_known,
    declaration: declaration
      ? {
          country: declaration.country,
          subdivision: declaration.subdivision,
          meetsAge: declaration.meets_age,
          thresholdAge: declaration.threshold_age,
          declaredAt: declaration.declared_at,
        }
      : null,
    limitsKnown: response.limits_known,
    limits: limits
      ? {
          savedGames: limits.saved_games,
          creationsPerWindow: limits.creations_per_window,
          sessionsPerWindow: limits.sessions_per_window,
          windowDays: limits.window_days,
          playersPerSession: limits.players_per_session,
          simultaneousRooms: limits.simultaneous_rooms,
          storageMB: limits.storage_mb,
        }
      : null,
  };
}

// Maps a refusal to what the caller can do about it. A code this build does not know is
// `unavailable`: the screen then says only that it could not be done.
export function meFailure(failure: HttpFailure): MeFailure {
  if (failure.kind !== 'http') return { kind: 'unavailable', failure };
  if (failure.status === 401) return { kind: 'unauthenticated' };
  if (failure.code === notAnAccountCode) return { kind: 'not-account' };
  if (failure.code === invalidModeCode || failure.code === invalidLanguageCode) {
    return { kind: 'invalid' };
  }
  if (failure.code === rateLimitedCode || failure.status === 429) {
    return { kind: 'rate-limited', retryAfterSeconds: failure.retryAfterSeconds };
  }
  return { kind: 'unavailable', failure };
}
