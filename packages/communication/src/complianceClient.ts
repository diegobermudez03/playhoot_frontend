import {
  acceptanceNotWithdrawableCode,
  acceptancesPath,
  acceptanceResponseSchema,
  acceptanceTextResponseSchema,
  acceptanceUnknownTextCode,
  declarationConflictCode,
  declarationInvalidCode,
  declarationPath,
  declarationResponseSchema,
  rateLimitedCode,
  textDownloadPath,
  textNotFoundCode,
  textPath,
  type AcceptanceAction,
  type AcceptanceRequest,
  type DeclarationRequest,
} from '@playhoot/protocol';
import type { HttpClient, HttpFailure } from './http';
import { err, ok, type Result } from './result';

// One published text as the person is shown it, with whether this exact version already stands
// accepted for them.
export interface AcceptanceText {
  kind: string;
  version: number;
  language: string;
  content: string;
  publishedAt: string;
  accepted: boolean;
}

// What a declaration left recorded. `recorded` and `unchanged` both mean it now stands.
export interface DeclarationResult {
  outcome: string;
  // The age the place asked for.
  thresholdAge: number;
}

export type ComplianceFailure =
  // Nothing of that kind is published yet, so there is nothing to read or to accept.
  | { kind: 'not-published' }
  // A different declaration is already recorded: a correction goes through support (P19§3).
  | { kind: 'conflict' }
  // The country, or the state or province it needs, is not one the backend accepts.
  | { kind: 'invalid-place' }
  // The acceptance named a text version the backend does not serve.
  | { kind: 'unknown-text' }
  // This kind is necessary and cannot be withdrawn.
  | { kind: 'not-withdrawable' }
  | { kind: 'rate-limited'; retryAfterSeconds: number | undefined }
  // No answer, a server failure, or a refusal this build does not know.
  | { kind: 'unavailable'; failure: HttpFailure };

export interface ComplianceClient {
  // The current version of a text in a language, and whether the caller accepted this version.
  readText(kind: string, language: string): Promise<Result<AcceptanceText, ComplianceFailure>>;
  // Where the same text can be downloaded as a file (P22§2).
  textDownloadUrl(kind: string, language: string): string;
  // Records that the caller accepted (or withdrew) one text at the exact version shown.
  recordAcceptance(
    kind: string,
    version: number,
    language: string,
    action: AcceptanceAction,
    context: string,
  ): Promise<Result<string, ComplianceFailure>>;
  // Records where the caller lives and whether they have the age the place asks for.
  recordDeclaration(
    country: string,
    subdivision: string,
    meetsAge: boolean,
  ): Promise<Result<DeclarationResult, ComplianceFailure>>;
}

export function createComplianceClient(http: HttpClient, baseUrl = ''): ComplianceClient {
  return {
    async readText(kind, language) {
      const result = await http.request({
        method: 'GET',
        path: textPath(kind, language),
        response: acceptanceTextResponseSchema,
      });
      if (!result.ok) return err(complianceFailure(result.error));
      return ok({
        kind: result.value.kind,
        version: result.value.version,
        language: result.value.language,
        content: result.value.content,
        publishedAt: result.value.published_at,
        accepted: result.value.accepted,
      });
    },

    textDownloadUrl(kind, language) {
      return baseUrl + textDownloadPath(kind, language);
    },

    async recordAcceptance(kind, version, language, action, context) {
      const body: AcceptanceRequest = { kind, version, language, action, context };
      const result = await http.request({
        method: 'POST',
        path: acceptancesPath,
        body,
        response: acceptanceResponseSchema,
      });
      return result.ok ? ok(result.value.outcome) : err(complianceFailure(result.error));
    },

    async recordDeclaration(country, subdivision, meetsAge) {
      const body: DeclarationRequest = { country, subdivision, meets_age: meetsAge };
      const result = await http.request({
        method: 'POST',
        path: declarationPath,
        body,
        response: declarationResponseSchema,
      });
      if (!result.ok) return err(complianceFailure(result.error));
      return ok({ outcome: result.value.outcome, thresholdAge: result.value.threshold_age });
    },
  };
}

// Maps a refusal to what the caller can do about it. Unknown codes are `unavailable`: the screen
// then says only that it could not be done.
export function complianceFailure(failure: HttpFailure): ComplianceFailure {
  if (failure.kind !== 'http') return { kind: 'unavailable', failure };
  switch (failure.code) {
    case textNotFoundCode:
      return { kind: 'not-published' };
    case declarationConflictCode:
      return { kind: 'conflict' };
    case declarationInvalidCode:
      return { kind: 'invalid-place' };
    case acceptanceUnknownTextCode:
      return { kind: 'unknown-text' };
    case acceptanceNotWithdrawableCode:
      return { kind: 'not-withdrawable' };
    case rateLimitedCode:
      return { kind: 'rate-limited', retryAfterSeconds: failure.retryAfterSeconds };
    default:
      return { kind: 'unavailable', failure };
  }
}
