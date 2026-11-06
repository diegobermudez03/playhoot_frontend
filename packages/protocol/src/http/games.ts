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
export const draftDiffPath = (gameUUID: string) => `${draftPath(gameUUID)}/diff`;
// The most revisions one page of the history holds (the backend's page).
export const draftRevisionsPageSize = 100;
export const draftRestorePath = (gameUUID: string) => `${draftPath(gameUUID)}/restore`;
export const draftBuildPath = (gameUUID: string) => `${draftPath(gameUUID)}/build`;
export const draftAssetPath = (gameUUID: string, key: string) =>
  `${draftPath(gameUUID)}/assets/${encodeURIComponent(key)}`;
export const draftAssetRemovePath = (gameUUID: string, key: string) =>
  `${draftAssetPath(gameUUID, key)}/remove`;

// A game's link for the creator's AI: one active at a time, valid 7 days. Creating one replaces
// the previous one; its secret URL is answered only by the creation.
export const aiLinkPath = (gameUUID: string) => `/v1/games/${encodeURIComponent(gameUUID)}/ai-link`;
export const aiLinkRevokePath = (gameUUID: string) => `${aiLinkPath(gameUUID)}/revoke`;

// Runs a scenario against the build of the draft's current revision and answers its result at
// once; nothing is kept.
export const draftSimulationsPath = (gameUUID: string) => `${draftPath(gameUUID)}/simulations`;

// Opens a preview: a private test game of a revision's succeeded build, played by its creator as
// each synthetic participant in turn over one live connection (`previewConnectPath`).
export const draftPreviewsPath = (gameUUID: string) => `${draftPath(gameUUID)}/previews`;

// The game's card (Game Management): name, description, logo, discovery photos, visibility and
// publication. Its images are read from signed URLs, uploaded as raw bodies through the API.
export const gamePath = (gameUUID: string) => `/v1/games/${encodeURIComponent(gameUUID)}`;
export const gameLogoPath = (gameUUID: string) => `${gamePath(gameUUID)}/logo`;
export const gameLogoRemovePath = (gameUUID: string) => `${gameLogoPath(gameUUID)}/remove`;
export const gamePhotosPath = (gameUUID: string) => `${gamePath(gameUUID)}/photos`;
export const gamePhotoRemovePath = (gameUUID: string, photoUUID: string) =>
  `${gamePhotosPath(gameUUID)}/${encodeURIComponent(photoUUID)}/remove`;
// Publishes the CURRENT revision of the open edition; only the owner can.
export const gamePublishPath = (gameUUID: string) => `${gamePath(gameUUID)}/publish`;
// Opens a new edition of a published game, starting from the published sources.
export const gameEditionsPath = (gameUUID: string) => `${gamePath(gameUUID)}/editions`;

// Card limits the backend enforces (Game Management).
export const cardLimits = {
  nameMax: 80,
  descriptionMax: 2000,
  logoBytes: 2 << 20,
  photoBytes: 5 << 20,
  photosMax: 8,
} as const;

// Who may create Sessions of a published game.
export const gameVisibilities = { public: 'public', private: 'private' } as const;

// Known reasons a game is not ready to publish (`409 not_ready` blockers).
export const publishBlockers = {
  buildNotSucceeded: 'build_not_succeeded',
  buildNotForCurrentRevision: 'build_not_for_current_revision',
  missingRequiredAssets: 'missing_required_assets',
  nameRequired: 'name_required',
  invalidName: 'invalid_name',
  revisionChanged: 'revision_changed',
} as const;

// The change envelope: what an AI produces for a person to paste, and what the API takes.
export const projectChangeFormat = 'playhoot.project-change.v1';

// A scenario an AI writes for a simulation, and the result it reads back.
export const scenarioFormat = 'playhoot.scenario.v1';
export const simulationResultFormat = 'playhoot.simulation-result.v1';

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
  buildNotReady: 'build_not_ready',
  invalidScenario: 'invalid_scenario',
  simulationsBusy: 'simulations_busy',
  invalidPlayers: 'invalid_players',
  previewUnavailable: 'preview_unavailable',
  previewScriptFailure: 'preview_script_failure',
  invalidCard: 'invalid_card',
  imageTooLarge: 'image_too_large',
  tooManyPhotos: 'too_many_photos',
  imageNotFound: 'image_not_found',
  notReady: 'not_ready',
  notPublished: 'not_published',
  editionOpen: 'edition_open',
  publishing: 'publishing',
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
  // The game's preliminary name (1..80 characters), confirmed or replaced when it is published.
  name: string;
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
  // The index of the edit it is about (`edit_not_found`, `edit_ambiguous`, ...).
  edit: z.number().int().optional(),
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
  // Find/replace edits of existing files, applied in order on the base revision.
  edits?: { path: string; find: string; replace: string; all?: boolean }[];
  delete: string[];
  idempotency_key: string;
}

export const draftChangeResponseSchema = z.object({
  outcome: z.string(),
  revision: z.number().int(),
  build: z.object({ status: z.string() }).nullish(),
  asset: draftAssetSchema.nullish(),
  // The unified diff of each file the change edited, cut at 8 KiB when truncated.
  diffs: z
    .array(z.object({ path: z.string(), diff: z.string(), truncated: z.boolean().optional() }))
    .nullish(),
});

// The body of a refused change, upload or restore: the backend's error body plus what it adds.
export const draftRefusalSchema = z.object({
  code: z.string().optional(),
  message: z.string().optional(),
  current_revision: z.number().optional(),
  diagnostics: z.array(draftDiagnosticSchema).optional(),
  // A simulation refused because the revision's build has not succeeded (yet).
  build: z.object({ status: z.string() }).passthrough().nullish(),
  build_status: z.string().optional(),
  // A preview refused for its number of players: the range the game accepts.
  min: z.number().int().optional(),
  max: z.number().int().optional(),
});

// What the workspace summarizes of a simulation's result. Every other field is kept untouched:
// the person copies the whole result back to their AI.
export const simulationResultSchema = z
  .object({
    format: z.string(),
    revision: z.number().optional(),
    finished: z.boolean().optional(),
    stopped: z.unknown().optional(),
    commands: z.array(z.unknown()).nullish(),
    rejected: z.array(z.unknown()).nullish(),
    events: z.array(z.unknown()).nullish(),
    errors: z.array(z.unknown()).nullish(),
    script_error: z.unknown().optional(),
  })
  .passthrough();

// A revision with its provenance. `kind`, `origin` and `actor` may grow; absent fields do not apply.
export const draftRevisionsResponseSchema = z.array(
  z.object({
    number: z.number().int(),
    kind: z.string(),
    origin: z.string().optional(),
    actor: z.string().optional().default(''),
    parent: z.number().int().optional(),
    restored_from: z.number().int().optional(),
    from: z
      .object({
        game_uuid: z.string(),
        version_uuid: z.string(),
        revision: z.number().int().optional(),
      })
      .optional(),
    sdk: z.string().optional().default(''),
    files: z.number(),
    created_at: z.string(),
  }),
);

// Two revisions compared: each differing file with its status and unified diff (cut at 8 KiB when
// `truncated`, absent when `omitted` because the comparison's 64 KiB were spent).
export const draftDiffResponseSchema = z.object({
  from: z.number().int(),
  to: z.number().int(),
  files: z
    .array(
      z.object({
        path: z.string(),
        status: z.string(),
        diff: z.string().optional(),
        truncated: z.boolean().optional(),
        omitted: z.boolean().optional(),
      }),
    )
    .nullish()
    .default([]),
});

export interface RestoreRevisionRequest {
  revision: number;
  base_revision: number;
  idempotency_key: string;
}

export const aiLinkCreatedSchema = z.object({
  url: z.string().min(1),
  expires_at: z.string(),
});

export const aiLinkStatusSchema = z.object({
  active: z.boolean(),
  created_at: z.string().nullish(),
  expires_at: z.string().nullish(),
});

export interface CreatePreviewRequest {
  revision?: number;
  players: number;
}

export const previewCreatedSchema = z.object({
  preview_uuid: z.string().min(1),
  revision: z.number().int(),
  participants: z.array(z.string().min(1)),
});

export type CreateGameResponse = z.infer<typeof createGameResponseSchema>;
export type DraftResponse = z.infer<typeof draftResponseSchema>;
export type BuildResponse = z.infer<typeof buildSchema>;
export type DraftChangeResponse = z.infer<typeof draftChangeResponseSchema>;
export type DraftRevisionsResponse = z.infer<typeof draftRevisionsResponseSchema>;
export type SimulationResultResponse = z.infer<typeof simulationResultSchema>;

const cardImageSchema = z.object({
  uuid: z.string(),
  mime_type: z.string(),
  size: z.number(),
  url: z.string().optional(),
  url_expires_at: z.string().optional(),
});

export const gameCardSchema = z.object({
  game_uuid: z.string(),
  name: z.string(),
  description: z.string(),
  logo: cardImageSchema.nullish(),
  photos: z.array(cardImageSchema).nullish(),
  visibility: z.string(),
  published: z.boolean(),
  published_at: z.string().nullish(),
  // Whether an edition is open (its draft can change) and whether a publication is under way.
  editing: z.boolean(),
  publishing: z.boolean(),
  // The publication players get: the latest completed release; null before the first.
  live: z
    .object({
      release_sequence: z.number(),
      revision: z.number(),
      version_uuid: z.string(),
      published_at: z.string(),
      // The languages the live version's game is written in, its main one first.
      languages: z.array(z.string()).default([]),
    })
    .nullish(),
});

export interface UpdateCardRequest {
  name?: string;
  description?: string;
}

export const cardOutcomeSchema = z.object({
  outcome: z.string(),
  image: z.object({ uuid: z.string(), mime_type: z.string(), size: z.number() }).optional(),
});

export interface PublishRequest {
  visibility: string;
  name?: string;
  idempotency_key: string;
}

export const publishedSchema = z.object({
  outcome: z.string(),
  release_uuid: z.string(),
  sequence: z.number(),
  version_uuid: z.string(),
  revision: z.number(),
  visibility: z.string(),
});

// Why a publication was refused: each blocker names what to fix.
export const publishRefusalSchema = z.object({
  code: z.string().optional(),
  blockers: z
    .array(
      z
        .object({
          code: z.string(),
          build_status: z.string().optional(),
          keys: z.array(z.string()).optional(),
        })
        .passthrough(),
    )
    .optional(),
});

export const editionOpenedSchema = z.object({ version_uuid: z.string(), revision: z.number() });

export type GameCardResponse = z.infer<typeof gameCardSchema>;

// The caller's own games, newest first (`GET /v1/games`, the same path that creates one).
export const myGamesPath = createGamePath;

export const myGamesSchema = z.array(
  z.object({
    game_uuid: z.string().min(1),
    name: z.string(),
    published: z.boolean(),
    // `public` or `private`; another value may come.
    visibility: z.string(),
    // A version is being built for it (an edition is open).
    editing: z.boolean(),
    // A publication is under way.
    publishing: z.boolean(),
    updated_at: z.string(),
  }),
);

export type MyGamesResponse = z.infer<typeof myGamesSchema>;
