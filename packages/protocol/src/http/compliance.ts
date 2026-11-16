import { z } from 'zod';

// Compliance over HTTP (backend `api/compliance/handler.go`): the residence-and-age declaration
// a gated function asks for, and the versioned texts people accept.

// A function the market matrix enables or disables per market. The backend may name one this
// build does not know: the declaration screen then says only that something needs the
// declaration, which is true of every one of them.
export const marketFunctions = [
  'create-games',
  'subscribe',
  'teach',
  'minor-class-participation',
  'minor-family-participation',
  'interactive-use',
] as const;
export type MarketFunction = (typeof marketFunctions)[number];

// The ones this build names when it sends a person to the declaration.
export const marketFunctionKinds = {
  createGames: 'create-games',
  subscribe: 'subscribe',
  teach: 'teach',
  minorClassParticipation: 'minor-class-participation',
  minorFamilyParticipation: 'minor-family-participation',
  interactiveUse: 'interactive-use',
} as const satisfies Record<string, MarketFunction>;

// How a gated operation refuses (backend `api/games/handler.go`, `api/play/market_access.go`):
// over HTTP as a 403 with `function`, and on a live connection as a rejection reason.
export const declarationRequiredCode = 'declaration_required';
export const marketRestrictedCode = 'market_restricted';

// The refusal body of a gated operation: `function` says which one was asked for.
export const gateRefusalSchema = z.object({ function: z.string().optional() });

// POST /v1/compliance/declaration (Bearer, account) → 200 {outcome, threshold_age}.
// `409 conflict` when a different declaration is already recorded: a correction goes through
// support, not through answering again (P19§3). `400 invalid` when the country, or the state or
// province it needs, is not one the backend accepts.
export const declarationPath = '/v1/compliance/declaration';

export interface DeclarationRequest {
  // ISO 3166-1 alpha-2, upper case.
  country: string;
  // ISO 3166-2 subdivision suffix (`CA` of `US-CA`), empty where the market needs none.
  subdivision: string;
  // Declared having reached the age the place asks for. A false answer records a binding
  // minority signal and the function stays restricted (P19§3).
  meets_age: boolean;
}

// `recorded` and `unchanged` both mean the declaration now stands.
export const declarationOutcomes = ['recorded', 'unchanged', 'conflict', 'invalid'] as const;
export type DeclarationOutcome = (typeof declarationOutcomes)[number];

export const declarationResponseSchema = z.object({
  outcome: z.string().min(1),
  // The age the place asked for when the declaration was recorded.
  threshold_age: z.number().int().nonnegative(),
});

export const declarationConflictCode = 'conflict';
export const declarationInvalidCode = 'invalid';

// The texts a person accepts. The backend may publish others; this build names these.
export const textKinds = ['terms', 'own-data', 'class-data-agreement', 'marketing'] as const;
export type TextKind = (typeof textKinds)[number];

// What a sign-in must have standing before it continues (D-037). Both are recorded at the exact
// version shown.
export const registrationTextKinds = ['terms', 'own-data'] as const satisfies readonly TextKind[];

// GET /v1/compliance/texts/{kind}?language={language} → 200 the current version of the text in
// that language, and whether the caller has accepted this exact version. Readable without a
// credential (`accepted` is then false). `404 text_not_found` while nothing is published yet.
export function textPath(kind: string, language?: string): string {
  const path = `/v1/compliance/texts/${encodeURIComponent(kind)}`;
  return language ? `${path}?${new URLSearchParams({ language }).toString()}` : path;
}

// The same text as a file to keep (P22§2).
export function textDownloadPath(kind: string, language?: string): string {
  const query = new URLSearchParams({ download: '1', ...(language ? { language } : {}) });
  return `/v1/compliance/texts/${encodeURIComponent(kind)}?${query.toString()}`;
}

export const textNotFoundCode = 'text_not_found';

export const acceptanceTextResponseSchema = z.object({
  kind: z.string().min(1),
  version: z.number().int().positive(),
  language: z.string().min(1),
  content: z.string(),
  published_at: z.string().min(1),
  accepted: z.boolean(),
});

// POST /v1/compliance/acceptances (Bearer, account) → 200 {outcome}. The version and language
// are the ones the person was shown, so the record points at exactly what they read (P22§3).
export const acceptancesPath = '/v1/compliance/acceptances';

export const acceptanceActions = ['accepted', 'withdrawn'] as const;
export type AcceptanceAction = (typeof acceptanceActions)[number];

export interface AcceptanceRequest {
  kind: string;
  version: number;
  language: string;
  action: AcceptanceAction;
  // Where the acceptance was given, kept with the record (`registration`, `preferences`).
  context: string;
}

// Where an acceptance was given, as this build names the places.
export const acceptanceContexts = {
  registration: 'registration',
  preferences: 'preferences',
} as const;

export const acceptanceResponseSchema = z.object({ outcome: z.string().min(1) });

// Outcomes `recorded` and `unchanged` both mean the record now says what the person chose.
export const acceptanceOutcomes = [
  'recorded',
  'unchanged',
  'unknown_text',
  'not_withdrawable',
  'invalid',
] as const;
export type AcceptanceOutcome = (typeof acceptanceOutcomes)[number];

export const acceptanceUnknownTextCode = 'unknown_text';
export const acceptanceNotWithdrawableCode = 'not_withdrawable';
