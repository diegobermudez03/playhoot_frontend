import { z } from 'zod';

// Game authoring (backend `api/games`, `api/README.md` "The games route group"): an account creates
// a game and changes the version being built for it (its draft). Every route answers `404` for a
// game that does not exist or is someone else's (never told apart) and `409 not_editable` when it
// has no version being built. Values the backend lists (statuses, outcomes, stages, kinds) may
// grow: schemas take any string and the known ones live in the constants below.

export const createGamePath = '/v1/games';
export const draftPath = (gameUUID: string) => `/v1/games/${encodeURIComponent(gameUUID)}/draft`;
export const draftChangesPath = (gameUUID: string) => `${draftPath(gameUUID)}/changes`;
export const draftRevisionsPath = (gameUUID: string) => `${draftPath(gameUUID)}/revisions`;
export const draftRestorePath = (gameUUID: string) => `${draftPath(gameUUID)}/restore`;
export const draftBuildPath = (gameUUID: string) => `${draftPath(gameUUID)}/build`;
export const draftAssetPath = (gameUUID: string, key: string) =>
  `${draftPath(gameUUID)}/assets/${encodeURIComponent(key)}`;
export const draftAssetRemovePath = (gameUUID: string, key: string) =>
  `${draftAssetPath(gameUUID, key)}/remove`;

// The change envelope: what an AI produces for a person to paste, and what the API takes.
export const projectChangeFormat = 'playhoot.project-change.v1';

// The longest `wait` the build read accepts, in seconds.
export const maxBuildWaitSeconds = 20;

// Error codes the games routes answer with.
export const gamesErrorCodes = {
  notEditable: 'not_editable',
  revisionConflict: 'revision_conflict',
  invalidChange: 'invalid_change',
  idempotencyConflict: 'idempotency_conflict',
  revisionNotFound: 'revision_not_found',
  assetNotDeclared: 'asset_not_declared',
  assetTooLarge: 'asset_too_large',
  invalidAsset: 'invalid_asset',
  uploadsBusy: 'uploads_busy',
  buildNotFound: 'build_not_found',
} as const;

// Known outcomes of a change, a restore and an asset upload or removal.
export const draftOutcomes = {
  applied: 'applied',
  unchanged: 'unchanged',
  attached: 'attached',
  removed: 'removed',
} as const;

// Known build statuses (uppercase, like the backend's other statuses).
export const buildStatuses = {
  queued: 'QUEUED',
  running: 'RUNNING',
  succeeded: 'SUCCEEDED',
  failed: 'FAILED',
  superseded: 'SUPERSEDED',
} as const;

// A build diagnostic's stage: the game tools' own, the backend's checks of the output, or the
// platform failing (nothing to fix in the game).
export const infrastructureStage = 'infrastructure';

// Known asset statuses.
export const assetStatuses = {
  missing: 'missing',
  ready: 'ready',
  undeclared: 'undeclared',
} as const;

// Known asset types (the backend's asset type catalog).
export const assetTypes = ['image', 'audio', 'video'] as const;

export interface CreateGameRequest {
  idempotency_key: string;
}

export const createGameResponseSchema = z.object({
  game_uuid: z.string().min(1),
  version_uuid: z.string().min(1),
  revision: z.number().int(),
});

export const draftDiagnosticSchema = z.object({
  path: z.string().optional().default(''),
  code: z.string().optional().default(''),
  message: z.string(),
});

export const buildDiagnosticSchema = z.object({
  stage: z.string(),
  code: z.string().optional(),
  file: z.string().optional(),
  line: z.number().optional(),
  column: z.number().optional(),
  message: z.string(),
});

const artifactSchema = z.object({ sha256: z.string(), size: z.number() });

export const buildSchema = z.object({
  revision: z.number().int(),
  status: z.string(),
  diagnostics: z.array(buildDiagnosticSchema).nullish().default([]),
  server: artifactSchema.nullish(),
  client: artifactSchema.nullish(),
  aspect_ratio: z.string().nullish(),
  reused: z.boolean().optional().default(false),
  queued_at: z.string().nullish(),
  started_at: z.string().nullish(),
  finished_at: z.string().nullish(),
});

export const draftFileSchema = z.object({
  path: z.string(),
  sha256: z.string(),
  size: z.number(),
  content: z.string().nullish(),
});

export const draftAssetSchema = z.object({
  key: z.string(),
  type: z.string(),
  description: z.string().nullish(),
  optional: z.boolean().nullish(),
  status: z.string(),
  sha256: z.string().nullish(),
  size: z.number().nullish(),
  mime_type: z.string().nullish(),
  url: z.string().nullish(),
  url_expires_at: z.string().nullish(),
});

export const draftAttemptSchema = z.object({
  kind: z.string().optional().default('change'),
  outcome: z.string(),
  base_revision: z.number().nullish(),
  revision: z.number().nullish(),
  origin: z.string().optional().default(''),
  diagnostics: z.array(draftDiagnosticSchema).nullish().default([]),
  created_at: z.string(),
});

export const draftResponseSchema = z.object({
  game_uuid: z.string(),
  version_uuid: z.string(),
  status: z.string(),
  current_revision: z.number().int(),
  revision: z.number().int(),
  files: z.array(draftFileSchema).nullish().default([]),
  assets: z.array(draftAssetSchema).nullish().default([]),
  asset_diagnostics: z.array(draftDiagnosticSchema).nullish().default([]),
  attempts: z.array(draftAttemptSchema).nullish().default([]),
  build: buildSchema.nullish(),
  last_successful_build: buildSchema.nullish(),
});

export interface ProjectChangeRequest {
  format: typeof projectChangeFormat;
  base_revision: number;
  files: { path: string; content: string }[];
  delete: string[];
  idempotency_key: string;
}

export const draftChangeResponseSchema = z.object({
  outcome: z.string(),
  revision: z.number().int(),
  build: z.object({ status: z.string() }).nullish(),
  asset: draftAssetSchema.nullish(),
});

// The body of a refused change, upload or restore: the backend's error body plus what it adds.
export const draftRefusalSchema = z.object({
  code: z.string().optional(),
  message: z.string().optional(),
  current_revision: z.number().optional(),
  diagnostics: z.array(draftDiagnosticSchema).optional(),
});

export const draftRevisionsResponseSchema = z.array(
  z.object({
    number: z.number().int(),
    source: z.string(),
    files: z.number(),
    created_at: z.string(),
  }),
);

export interface RestoreRevisionRequest {
  revision: number;
  base_revision: number;
  idempotency_key: string;
}

export type CreateGameResponse = z.infer<typeof createGameResponseSchema>;
export type DraftResponse = z.infer<typeof draftResponseSchema>;
export type BuildResponse = z.infer<typeof buildSchema>;
export type DraftChangeResponse = z.infer<typeof draftChangeResponseSchema>;
export type DraftRevisionsResponse = z.infer<typeof draftRevisionsResponseSchema>;
