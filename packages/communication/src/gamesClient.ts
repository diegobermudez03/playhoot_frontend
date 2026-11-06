import {
  aiLinkCreatedSchema,
  aiLinkPath,
  aiLinkRevokePath,
  aiLinkStatusSchema,
  createGamePath,
  createGameResponseSchema,
  draftAssetPath,
  draftAssetRemovePath,
  draftBuildPath,
  draftChangeResponseSchema,
  draftDiffPath,
  draftDiffResponseSchema,
  draftChangesPath,
  draftPath,
  draftRefusalSchema,
  draftResponseSchema,
  draftRestorePath,
  draftRevisionsPath,
  draftRevisionsResponseSchema,
  draftSimulationsPath,
  draftPreviewsPath,
  previewCreatedSchema,
  type CreatePreviewRequest,
  buildSchema,
  cardOutcomeSchema,
  editionOpenedSchema,
  gameCardSchema,
  gameEditionsPath,
  gameLogoPath,
  gameLogoRemovePath,
  gamePath,
  gamePhotoRemovePath,
  gamePhotosPath,
  gamePublishPath,
  publishedSchema,
  publishRefusalSchema,
  type GameCardResponse,
  type PublishRequest,
  type UpdateCardRequest,
  gamesErrorCodes,
  myGamesPath,
  myGamesSchema,
  maxBuildWaitSeconds,
  projectChangeFormat,
  rateLimitedCode,
  simulationResultSchema,
  type BuildResponse,
  type CreateGameRequest,
  type DraftChangeResponse,
  type DraftResponse,
  type ProjectChangeRequest,
  type RestoreRevisionRequest,
  type SimulationResultResponse,
} from '@playhoot/protocol';

import type { Decoder, HttpClient, HttpFailure } from './http';
import { err, ok, type Result } from './result';

// Game authoring over REST (backend `api/games`). Every string the backend lists (statuses,
// outcomes, stages, kinds) stays a string: known values are in `@playhoot/protocol`.

// One of the caller's games, as their list shows it.
export interface MyGame {
  gameUUID: string;
  name: string;
  published: boolean;
  // `public` or `private` (another value may come).
  visibility: string;
  // A version is being built for it.
  editing: boolean;
  // A publication is under way.
  publishing: boolean;
  updatedAt: string;
}

export interface CreatedGame {
  gameUUID: string;
  versionUUID: string;
  revision: number;
}

export interface DraftDiagnostic {
  path: string;
  code: string;
  // The index of the edit it is about, when it is about one.
  edit?: number;
  message: string;
}

export interface BuildDiagnostic {
  stage: string;
  code: string | null;
  file: string | null;
  line: number | null;
  column: number | null;
  message: string;
}

export interface DraftBuild {
  revision: number;
  status: string;
  diagnostics: BuildDiagnostic[];
  reused: boolean;
  queuedAt: string | null;
  finishedAt: string | null;
}

export interface DraftFile {
  path: string;
  sha256: string;
  size: number;
  // Present when the draft was read with its content.
  content: string | null;
}

export interface DraftAsset {
  key: string;
  type: string;
  description: string;
  optional: boolean;
  status: string;
  sha256: string | null;
  size: number | null;
  mimeType: string | null;
  // A short-lived link to the content, when there is some.
  url: string | null;
}

export interface DraftAttempt {
  kind: string;
  outcome: string;
  baseRevision: number | null;
  revision: number | null;
  origin: string;
  diagnostics: DraftDiagnostic[];
  createdAt: string;
}

export interface Draft {
  gameUUID: string;
  versionUUID: string;
  status: string;
  currentRevision: number;
  // The revision this read holds (the current one unless an earlier one was asked for).
  revision: number;
  files: DraftFile[];
  assets: DraftAsset[];
  assetDiagnostics: DraftDiagnostic[];
  attempts: DraftAttempt[];
  build: DraftBuild | null;
  lastSuccessfulBuild: DraftBuild | null;
}

// A revision with its provenance: what made it (`kind`: template, edition, change, restore,
// asset, or one this client does not know), from where (`origin`: web, api, mcp; null when the
// platform made it), the actor kind, its parent, the revision a restore brought back and the
// version it was copied from (a template, or the published version of a new edition).
export interface DraftRevision {
  number: number;
  kind: string;
  origin: string | null;
  actor: string;
  parent: number | null;
  restoredFrom: number | null;
  from: { gameUUID: string; versionUUID: string; revision: number | null } | null;
  sdk: string;
  files: number;
  createdAt: string;
}

// One file that differs between two revisions. `diff` is null when it was omitted (ask for that
// path alone).
export interface RevisionFileDiff {
  path: string;
  status: string;
  diff: string | null;
  truncated: boolean;
  omitted: boolean;
}

// Revision `from` (0: the empty project) compared with revision `to`.
export interface RevisionDiff {
  from: number;
  to: number;
  files: RevisionFileDiff[];
}

// One find/replace edit of an existing file: `find` must appear once, or every occurrence is
// replaced with `all`.
export interface DraftFileEdit {
  path: string;
  find: string;
  replace: string;
  all?: boolean;
}

export interface DraftChange {
  baseRevision: number;
  files: { path: string; content: string }[];
  // Applied in order on the base revision, before `files` and `delete`; absent means none.
  edits?: DraftFileEdit[];
  delete: string[];
}

// An edited file's unified diff, as the backend answered it (cut at 8 KiB when `truncated`).
export interface DraftFileDiff {
  path: string;
  diff: string;
  truncated: boolean;
}

// What a change, restore, upload or removal answered. `outcome` is `applied`, `unchanged`,
// `attached` or `removed`, or one this client does not know.
export interface DraftChangeResult {
  outcome: string;
  revision: number;
  // The build of `revision` as just queued, when a revision was made.
  buildStatus: string | null;
  asset: DraftAsset | null;
  // The diffs of the files a change edited; absent when it edited none.
  diffs?: DraftFileDiff[];
}

// A link for the creator's AI, as created: `url` holds the secret token and is never answered again.
export interface CreatedAiLink {
  url: string;
  expiresAt: string;
}

// A simulation's result: `raw` is the backend's whole answer, kept as it came for the person to
// copy back to their AI; the rest is what the workspace summarizes of it.
export interface SimulationResult {
  raw: unknown;
  revision: number | null;
  // Whether the game ended (`finish()`) within the scenario.
  finished: boolean | null;
  // Why the simulation stopped before the scenario's end, when it did.
  stopped: string | null;
  commands: number;
  rejected: number;
  events: number;
  errors: number;
  // The message of the script's failure, when the game's code threw.
  scriptError: string | null;
}

// A preview opened for the creator: its connection is `PreviewConnector.connect(previewUUID)`.
export interface CreatedPreview {
  previewUUID: string;
  revision: number;
  participants: string[];
}

// Whether the game has an active link for the creator's AI, without its secret.
export interface AiLinkStatus {
  active: boolean;
  createdAt: string | null;
  expiresAt: string | null;
}

// Why a games call did not do what it asked, by what the caller can do about it.
// An image of the game's card: the URL is a signed read valid a few minutes.
export interface CardImage {
  uuid: string;
  mimeType: string;
  size: number;
  url: string | null;
}

export interface GameCard {
  gameUUID: string;
  name: string;
  description: string;
  logo: CardImage | null;
  photos: CardImage[];
  visibility: string;
  published: boolean;
  publishedAt: string | null;
  // An edition is open: the draft can change.
  editing: boolean;
  // A publication is under way (it completes on the next publish or edit).
  publishing: boolean;
  // The publication players get, null before the first.
  live: LivePublication | null;
}

export interface LivePublication {
  releaseSequence: number;
  revision: number;
  versionUUID: string;
  publishedAt: string;
  // The languages the game is written in, its main one first (BCP 47 tags).
  languages: string[];
}

export interface Publication {
  releaseUUID: string;
  sequence: number;
  versionUUID: string;
  revision: number;
  visibility: string;
}

// Why the game cannot be published yet: what to fix for each.
export interface PublishBlocker {
  code: string;
  buildStatus: string | null;
  keys: string[];
}

export type GamesFailure =
  // The game does not exist or is someone else's (the backend never tells them apart).
  | { kind: 'not-found' }
  // The game has no version being built.
  | { kind: 'not-editable' }
  // The draft changed since `base_revision`: read it again and redo the change.
  | { kind: 'conflict'; currentRevision: number | null }
  // The change breaks the source rules, or the asset's content was refused.
  | { kind: 'invalid'; diagnostics: DraftDiagnostic[] }
  // The asset is larger than its type allows (nothing was stored).
  | { kind: 'too-large'; diagnostics: DraftDiagnostic[] }
  // The current revision declares no asset with that key.
  | { kind: 'not-declared' }
  // The idempotency key was used for another request.
  | { kind: 'idempotency-conflict' }
  | { kind: 'revision-not-found' }
  | { kind: 'build-not-found' }
  // The current revision's build has not succeeded (yet): a simulation needs it.
  | { kind: 'build-not-ready'; buildStatus: string | null }
  // A preview asked for a number of players the game does not accept: it takes `min`..`max`.
  | { kind: 'invalid-players'; min: number | null; max: number | null }
  // The game's start() failed in its script when the preview began: simulating shows why.
  | { kind: 'script-failure' }
  // The request was malformed (a client bug, never the person's doing).
  | { kind: 'bad-request' }
  // Too many requests or uploads right now: try again after `retryAfterSeconds`.
  | { kind: 'busy'; retryAfterSeconds: number | undefined }
  // The card's name or description breaks its limits, or an image is not PNG, JPEG or WebP.
  | { kind: 'invalid-card' }
  | { kind: 'too-many-photos' }
  | { kind: 'image-not-found' }
  // The game cannot be published yet: each blocker says what is missing.
  | { kind: 'not-ready'; blockers: PublishBlocker[] }
  // A new edition needs a published game, no edition open and no publication under way.
  | { kind: 'not-published' }
  | { kind: 'edition-open' }
  | { kind: 'publishing' }
  // Anything else: no answer, a server failure, an unknown refusal or an unexpected body.
  | { kind: 'unavailable'; failure: HttpFailure };

export interface GamesClient {
  // The caller's own games, newest first.
  listGames(): Promise<Result<MyGame[], GamesFailure>>;
  createGame(name: string, idempotencyKey: string): Promise<Result<CreatedGame, GamesFailure>>;
  readCard(gameUUID: string): Promise<Result<GameCard, GamesFailure>>;
  // Changes the card's name and/or description; allowed published or not.
  updateCard(
    gameUUID: string,
    change: { name?: string; description?: string },
  ): Promise<Result<void, GamesFailure>>;
  // Sends the image's bytes; the backend reads their real type and checks the size.
  uploadLogo(
    gameUUID: string,
    file: Blob,
    idempotencyKey: string,
  ): Promise<Result<void, GamesFailure>>;
  removeLogo(gameUUID: string): Promise<Result<void, GamesFailure>>;
  uploadPhoto(
    gameUUID: string,
    file: Blob,
    idempotencyKey: string,
  ): Promise<Result<void, GamesFailure>>;
  removePhoto(gameUUID: string, photoUUID: string): Promise<Result<void, GamesFailure>>;
  // Publishes the current revision of the open edition; `name` replaces the card name first.
  publish(
    gameUUID: string,
    request: { visibility: string; name?: string },
    idempotencyKey: string,
  ): Promise<Result<Publication, GamesFailure>>;
  // Opens a new edition of a published game, its draft starting from the published sources.
  openEdition(
    gameUUID: string,
    idempotencyKey: string,
  ): Promise<Result<{ versionUUID: string; revision: number }, GamesFailure>>;
  readDraft(
    gameUUID: string,
    options?: { revision?: number; content?: boolean },
  ): Promise<Result<Draft, GamesFailure>>;
  applyChange(
    gameUUID: string,
    change: DraftChange,
    idempotencyKey: string,
  ): Promise<Result<DraftChangeResult, GamesFailure>>;
  restoreRevision(
    gameUUID: string,
    revision: number,
    baseRevision: number,
    idempotencyKey: string,
  ): Promise<Result<DraftChangeResult, GamesFailure>>;
  // Compares revision `from` (0: the empty project) with `to` (the current one when absent), only
  // `path` when given.
  diffRevisions(
    gameUUID: string,
    from: number,
    options?: { to?: number; path?: string },
  ): Promise<Result<RevisionDiff, GamesFailure>>;
  // A page of the history, newest first: the revisions below `before` (from the current one
  // when absent).
  listRevisions(gameUUID: string, before?: number): Promise<Result<DraftRevision[], GamesFailure>>;
  // Sends the file's bytes; the backend reads their real type and checks the declared limits.
  uploadAsset(
    gameUUID: string,
    key: string,
    file: Blob,
    idempotencyKey: string,
  ): Promise<Result<DraftChangeResult, GamesFailure>>;
  removeAsset(
    gameUUID: string,
    key: string,
    idempotencyKey: string,
  ): Promise<Result<DraftChangeResult, GamesFailure>>;
  // One revision's build. `waitSeconds` (at most 20) makes the backend answer as soon as the build
  // ended, so following a build needs no tight polling.
  readBuild(
    gameUUID: string,
    revision: number,
    waitSeconds?: number,
  ): Promise<Result<DraftBuild, GamesFailure>>;
  // Creates the game's link for the creator's AI, replacing the active one if any.
  createAiLink(gameUUID: string): Promise<Result<CreatedAiLink, GamesFailure>>;
  readAiLink(gameUUID: string): Promise<Result<AiLinkStatus, GamesFailure>>;
  revokeAiLink(gameUUID: string): Promise<Result<void, GamesFailure>>;
  // Opens a preview of `revision` (the current one by default) with `players` synthetic
  // participants; it needs that revision's build to have succeeded. Opening one ends the game's
  // previous preview.
  createPreview(
    gameUUID: string,
    players: number,
    revision?: number,
  ): Promise<Result<CreatedPreview, GamesFailure>>;
  // Runs `scenario` (a parsed `playhoot.scenario.v1` document, sent as is) against the build of
  // the current revision. Nothing is kept: the answer is the only copy of the result.
  runSimulation(
    gameUUID: string,
    scenario: unknown,
  ): Promise<Result<SimulationResult, GamesFailure>>;
}

export function createGamesClient(http: HttpClient): GamesClient {
  return {
    async listGames() {
      const result = await http.request({
        method: 'GET',
        path: myGamesPath,
        response: myGamesSchema,
      });
      if (!result.ok) return err(gamesFailure(result.error));
      return ok(
        result.value.map((game) => ({
          gameUUID: game.game_uuid,
          name: game.name,
          published: game.published,
          visibility: game.visibility,
          editing: game.editing,
          publishing: game.publishing,
          updatedAt: game.updated_at,
        })),
      );
    },

    async createGame(name, idempotencyKey) {
      const body: CreateGameRequest = { name, idempotency_key: idempotencyKey };
      const result = await http.request({
        method: 'POST',
        path: createGamePath,
        body,
        response: createGameResponseSchema,
      });
      if (!result.ok) return err(gamesFailure(result.error));
      return ok({
        gameUUID: result.value.game_uuid,
        versionUUID: result.value.version_uuid,
        revision: result.value.revision,
      });
    },

    async readCard(gameUUID) {
      const result = await http.request({
        method: 'GET',
        path: gamePath(gameUUID),
        response: gameCardSchema,
      });
      if (!result.ok) return err(gamesFailure(result.error));
      return ok(cardOf(result.value));
    },

    async updateCard(gameUUID, change) {
      const body: UpdateCardRequest = change;
      return done(
        await http.request({
          method: 'PATCH',
          path: gamePath(gameUUID),
          body,
          response: cardOutcomeSchema,
        }),
      );
    },

    async uploadLogo(gameUUID, file, idempotencyKey) {
      return done(
        await http.request({
          method: 'PUT',
          path: gameLogoPath(gameUUID),
          rawBody: { content: file, contentType: file.type || 'application/octet-stream' },
          headers: { 'Idempotency-Key': idempotencyKey },
          response: cardOutcomeSchema,
        }),
      );
    },

    async removeLogo(gameUUID) {
      return done(
        await http.request({
          method: 'POST',
          path: gameLogoRemovePath(gameUUID),
          response: cardOutcomeSchema,
        }),
      );
    },

    async uploadPhoto(gameUUID, file, idempotencyKey) {
      return done(
        await http.request({
          method: 'POST',
          path: gamePhotosPath(gameUUID),
          rawBody: { content: file, contentType: file.type || 'application/octet-stream' },
          headers: { 'Idempotency-Key': idempotencyKey },
          response: cardOutcomeSchema,
        }),
      );
    },

    async removePhoto(gameUUID, photoUUID) {
      return done(
        await http.request({
          method: 'POST',
          path: gamePhotoRemovePath(gameUUID, photoUUID),
          response: cardOutcomeSchema,
        }),
      );
    },

    async publish(gameUUID, request, idempotencyKey) {
      const body: PublishRequest = { ...request, idempotency_key: idempotencyKey };
      const result = await http.request({
        method: 'POST',
        path: gamePublishPath(gameUUID),
        body,
        response: publishedSchema,
      });
      if (!result.ok) return err(gamesFailure(result.error));
      return ok({
        releaseUUID: result.value.release_uuid,
        sequence: result.value.sequence,
        versionUUID: result.value.version_uuid,
        revision: result.value.revision,
        visibility: result.value.visibility,
      });
    },

    async openEdition(gameUUID, idempotencyKey) {
      const result = await http.request({
        method: 'POST',
        path: gameEditionsPath(gameUUID),
        body: { idempotency_key: idempotencyKey },
        response: editionOpenedSchema,
      });
      if (!result.ok) return err(gamesFailure(result.error));
      return ok({ versionUUID: result.value.version_uuid, revision: result.value.revision });
    },

    async readDraft(gameUUID, options = {}) {
      const query = new URLSearchParams();
      if (options.revision !== undefined) query.set('revision', String(options.revision));
      if (options.content) query.set('content', 'true');
      const search = query.size > 0 ? `?${query.toString()}` : '';
      const result = await http.request({
        method: 'GET',
        path: draftPath(gameUUID) + search,
        response: draftResponseSchema,
      });
      if (!result.ok) return err(gamesFailure(result.error));
      return ok(draftOf(result.value));
    },

    async applyChange(gameUUID, change, idempotencyKey) {
      const body: ProjectChangeRequest = {
        format: projectChangeFormat,
        base_revision: change.baseRevision,
        files: change.files,
        ...(change.edits && change.edits.length > 0 ? { edits: change.edits } : {}),
        delete: change.delete,
        idempotency_key: idempotencyKey,
      };
      return changeResult(
        await http.request({
          method: 'POST',
          path: draftChangesPath(gameUUID),
          body,
          response: draftChangeResponseSchema,
        }),
      );
    },

    async restoreRevision(gameUUID, revision, baseRevision, idempotencyKey) {
      const body: RestoreRevisionRequest = {
        revision,
        base_revision: baseRevision,
        idempotency_key: idempotencyKey,
      };
      return changeResult(
        await http.request({
          method: 'POST',
          path: draftRestorePath(gameUUID),
          body,
          response: draftChangeResponseSchema,
        }),
      );
    },

    async listRevisions(gameUUID, before) {
      const search = before === undefined ? '' : `?before=${String(before)}`;
      const result = await http.request({
        method: 'GET',
        path: `${draftRevisionsPath(gameUUID)}${search}`,
        response: draftRevisionsResponseSchema,
      });
      if (!result.ok) return err(gamesFailure(result.error));
      return ok(
        result.value.map((revision) => ({
          number: revision.number,
          kind: revision.kind,
          origin: revision.origin ?? null,
          actor: revision.actor,
          parent: revision.parent ?? null,
          restoredFrom: revision.restored_from ?? null,
          from: revision.from
            ? {
                gameUUID: revision.from.game_uuid,
                versionUUID: revision.from.version_uuid,
                revision: revision.from.revision ?? null,
              }
            : null,
          sdk: revision.sdk,
          files: revision.files,
          createdAt: revision.created_at,
        })),
      );
    },

    async diffRevisions(gameUUID, from, options) {
      const search = new URLSearchParams({ from: String(from) });
      if (options?.to !== undefined) search.set('to', String(options.to));
      if (options?.path !== undefined) search.set('path', options.path);
      const result = await http.request({
        method: 'GET',
        path: `${draftDiffPath(gameUUID)}?${search.toString()}`,
        response: draftDiffResponseSchema,
      });
      if (!result.ok) return err(gamesFailure(result.error));
      return ok({
        from: result.value.from,
        to: result.value.to,
        files: (result.value.files ?? []).map((file) => ({
          path: file.path,
          status: file.status,
          diff: file.diff ?? null,
          truncated: file.truncated ?? false,
          omitted: file.omitted ?? false,
        })),
      });
    },

    async uploadAsset(gameUUID, key, file, idempotencyKey) {
      return changeResult(
        await http.request({
          method: 'PUT',
          path: draftAssetPath(gameUUID, key),
          rawBody: { content: file, contentType: file.type || 'application/octet-stream' },
          headers: { 'Idempotency-Key': idempotencyKey },
          response: draftChangeResponseSchema,
        }),
      );
    },

    async removeAsset(gameUUID, key, idempotencyKey) {
      return changeResult(
        await http.request({
          method: 'POST',
          path: draftAssetRemovePath(gameUUID, key),
          body: { idempotency_key: idempotencyKey },
          response: draftChangeResponseSchema,
        }),
      );
    },

    async readBuild(gameUUID, revision, waitSeconds = 0) {
      const wait = Math.max(0, Math.min(maxBuildWaitSeconds, Math.floor(waitSeconds)));
      const query = new URLSearchParams({ revision: String(revision), wait: String(wait) });
      const result = await http.request({
        method: 'GET',
        path: `${draftBuildPath(gameUUID)}?${query.toString()}`,
        response: buildSchema,
      });
      if (!result.ok) return err(gamesFailure(result.error));
      return ok(buildOf(result.value));
    },

    async createAiLink(gameUUID) {
      const result = await http.request({
        method: 'POST',
        path: aiLinkPath(gameUUID),
        response: aiLinkCreatedSchema,
      });
      if (!result.ok) return err(gamesFailure(result.error));
      return ok({ url: result.value.url, expiresAt: result.value.expires_at });
    },

    async readAiLink(gameUUID) {
      const result = await http.request({
        method: 'GET',
        path: aiLinkPath(gameUUID),
        response: aiLinkStatusSchema,
      });
      if (!result.ok) return err(gamesFailure(result.error));
      return ok({
        active: result.value.active,
        createdAt: result.value.created_at ?? null,
        expiresAt: result.value.expires_at ?? null,
      });
    },

    async revokeAiLink(gameUUID) {
      const result = await http.request({
        method: 'POST',
        path: aiLinkRevokePath(gameUUID),
        response: noBody,
      });
      if (!result.ok) return err(gamesFailure(result.error));
      return ok(undefined);
    },

    async createPreview(gameUUID, players, revision) {
      const body: CreatePreviewRequest =
        revision === undefined ? { players } : { players, revision };
      const result = await http.request({
        method: 'POST',
        path: draftPreviewsPath(gameUUID),
        body,
        response: previewCreatedSchema,
      });
      if (!result.ok) return err(gamesFailure(result.error));
      return ok({
        previewUUID: result.value.preview_uuid,
        revision: result.value.revision,
        participants: result.value.participants,
      });
    },

    async runSimulation(gameUUID, scenario) {
      const result = await http.request({
        method: 'POST',
        path: draftSimulationsPath(gameUUID),
        body: scenario,
        response: simulationDecoder,
      });
      if (!result.ok) return err(gamesFailure(result.error));
      return ok(simulationOf(result.value.raw, result.value.parsed));
    },
  };
}

function done(result: Result<unknown, HttpFailure>): Result<void, GamesFailure> {
  return result.ok ? ok(undefined) : err(gamesFailure(result.error));
}

function cardOf(body: GameCardResponse): GameCard {
  const image = (value: NonNullable<GameCardResponse['logo']>): CardImage => ({
    uuid: value.uuid,
    mimeType: value.mime_type,
    size: value.size,
    url: value.url ?? null,
  });
  return {
    gameUUID: body.game_uuid,
    name: body.name,
    description: body.description,
    logo: body.logo ? image(body.logo) : null,
    photos: (body.photos ?? []).map(image),
    visibility: body.visibility,
    published: body.published,
    publishedAt: body.published_at ?? null,
    editing: body.editing,
    publishing: body.publishing,
    live: body.live
      ? {
          releaseSequence: body.live.release_sequence,
          revision: body.live.revision,
          versionUUID: body.live.version_uuid,
          publishedAt: body.live.published_at,
          languages: body.live.languages,
        }
      : null,
  };
}

// Checks the fields the workspace summarizes and keeps the body exactly as it came.
const simulationDecoder: Decoder<{ raw: unknown; parsed: SimulationResultResponse }> = {
  safeParse(value) {
    const parsed = simulationResultSchema.safeParse(value);
    if (!parsed.success) return { success: false, error: parsed.error };
    return { success: true, data: { raw: value, parsed: parsed.data } };
  },
};

function simulationOf(raw: unknown, body: SimulationResultResponse): SimulationResult {
  return {
    raw,
    revision: body.revision ?? null,
    finished: body.finished ?? null,
    stopped: reasonOf(body.stopped),
    commands: body.commands?.length ?? 0,
    rejected: body.rejected?.length ?? 0,
    events: body.events?.length ?? 0,
    errors: body.errors?.length ?? 0,
    scriptError: reasonOf(body.script_error),
  };
}

// A reason given as a string, or as an object with a `message` or `reason`.
function reasonOf(value: unknown): string | null {
  if (typeof value === 'string') return value === '' ? null : value;
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    for (const field of ['message', 'reason', 'code']) {
      if (typeof record[field] === 'string') return record[field] as string;
    }
    return JSON.stringify(value);
  }
  return null;
}

// Revoking answers 204 without a body.
const noBody: Decoder<unknown> = { safeParse: (value) => ({ success: true, data: value }) };

function changeResult(
  result: Result<DraftChangeResponse, HttpFailure>,
): Result<DraftChangeResult, GamesFailure> {
  if (!result.ok) return err(gamesFailure(result.error));
  const diffs = (result.value.diffs ?? []).map((diff) => ({
    path: diff.path,
    diff: diff.diff,
    truncated: diff.truncated ?? false,
  }));
  return ok({
    outcome: result.value.outcome,
    revision: result.value.revision,
    buildStatus: result.value.build?.status ?? null,
    asset: result.value.asset ? assetOf(result.value.asset) : null,
    ...(diffs.length > 0 ? { diffs } : {}),
  });
}

// Maps a refusal to what the caller can do about it. Unknown codes are `unavailable`.
export function gamesFailure(failure: HttpFailure): GamesFailure {
  if (failure.kind !== 'http') return { kind: 'unavailable', failure };
  const parsed = draftRefusalSchema.safeParse(failure.body);
  const details = parsed.success ? parsed.data : {};
  const diagnostics = (details.diagnostics ?? []).map(diagnosticOf);
  switch (failure.code) {
    case gamesErrorCodes.notEditable:
      return { kind: 'not-editable' };
    case gamesErrorCodes.revisionConflict:
      return { kind: 'conflict', currentRevision: details.current_revision ?? null };
    case gamesErrorCodes.invalidChange:
    case gamesErrorCodes.invalidAsset:
    case gamesErrorCodes.invalidScenario:
      return { kind: 'invalid', diagnostics };
    case gamesErrorCodes.assetTooLarge:
      return { kind: 'too-large', diagnostics };
    case gamesErrorCodes.assetNotDeclared:
      return { kind: 'not-declared' };
    case gamesErrorCodes.idempotencyConflict:
      return { kind: 'idempotency-conflict' };
    case gamesErrorCodes.revisionNotFound:
      return { kind: 'revision-not-found' };
    case gamesErrorCodes.buildNotFound:
      return { kind: 'build-not-found' };
    case gamesErrorCodes.buildNotReady:
      return {
        kind: 'build-not-ready',
        buildStatus: details.build?.status ?? details.build_status ?? null,
      };
    case gamesErrorCodes.invalidPlayers:
      return { kind: 'invalid-players', min: details.min ?? null, max: details.max ?? null };
    case gamesErrorCodes.previewScriptFailure:
      return { kind: 'script-failure' };
    case gamesErrorCodes.invalidCard:
      return { kind: 'invalid-card' };
    case gamesErrorCodes.imageTooLarge:
      return { kind: 'too-large', diagnostics };
    case gamesErrorCodes.tooManyPhotos:
      return { kind: 'too-many-photos' };
    case gamesErrorCodes.imageNotFound:
      return { kind: 'image-not-found' };
    case gamesErrorCodes.notReady: {
      const refusal = publishRefusalSchema.safeParse(failure.body);
      const blockers = refusal.success ? (refusal.data.blockers ?? []) : [];
      return {
        kind: 'not-ready',
        blockers: blockers.map((blocker) => ({
          code: blocker.code,
          buildStatus: blocker.build_status ?? null,
          keys: blocker.keys ?? [],
        })),
      };
    }
    case gamesErrorCodes.notPublished:
      return { kind: 'not-published' };
    case gamesErrorCodes.editionOpen:
      return { kind: 'edition-open' };
    case gamesErrorCodes.publishing:
      return { kind: 'publishing' };
    case gamesErrorCodes.uploadsBusy:
    case gamesErrorCodes.simulationsBusy:
    case gamesErrorCodes.previewUnavailable:
    case rateLimitedCode:
      return { kind: 'busy', retryAfterSeconds: failure.retryAfterSeconds };
  }
  if (failure.status === 400) return { kind: 'bad-request' };
  if (failure.status === 404) return { kind: 'not-found' };
  if (failure.status === 413) return { kind: 'too-large', diagnostics };
  if (failure.status === 429 || failure.status === 503) {
    return { kind: 'busy', retryAfterSeconds: failure.retryAfterSeconds };
  }
  return { kind: 'unavailable', failure };
}

function draftOf(body: DraftResponse): Draft {
  return {
    gameUUID: body.game_uuid,
    versionUUID: body.version_uuid,
    status: body.status,
    currentRevision: body.current_revision,
    revision: body.revision,
    files: (body.files ?? []).map((file) => ({
      path: file.path,
      sha256: file.sha256,
      size: file.size,
      content: file.content ?? null,
    })),
    assets: (body.assets ?? []).map(assetOf),
    assetDiagnostics: (body.asset_diagnostics ?? []).map(diagnosticOf),
    attempts: (body.attempts ?? []).map((attempt) => ({
      kind: attempt.kind,
      outcome: attempt.outcome,
      baseRevision: attempt.base_revision ?? null,
      revision: attempt.revision ?? null,
      origin: attempt.origin,
      diagnostics: (attempt.diagnostics ?? []).map(diagnosticOf),
      createdAt: attempt.created_at,
    })),
    build: body.build ? buildOf(body.build) : null,
    lastSuccessfulBuild: body.last_successful_build ? buildOf(body.last_successful_build) : null,
  };
}

function buildOf(build: BuildResponse): DraftBuild {
  return {
    revision: build.revision,
    status: build.status,
    diagnostics: (build.diagnostics ?? []).map((diagnostic) => ({
      stage: diagnostic.stage,
      code: diagnostic.code ?? null,
      file: diagnostic.file ?? null,
      line: diagnostic.line ?? null,
      column: diagnostic.column ?? null,
      message: diagnostic.message,
    })),
    reused: build.reused,
    queuedAt: build.queued_at ?? null,
    finishedAt: build.finished_at ?? null,
  };
}

type AssetBody = NonNullable<DraftResponse['assets']>[number];

function assetOf(asset: AssetBody): DraftAsset {
  return {
    key: asset.key,
    type: asset.type,
    description: asset.description ?? '',
    optional: asset.optional ?? false,
    status: asset.status,
    sha256: asset.sha256 ?? null,
    size: asset.size ?? null,
    mimeType: asset.mime_type ?? null,
    url: asset.url ?? null,
  };
}

function diagnosticOf(diagnostic: {
  path: string;
  code: string;
  edit?: number | undefined;
  message: string;
}): DraftDiagnostic {
  return {
    path: diagnostic.path,
    code: diagnostic.code,
    ...(diagnostic.edit === undefined ? {} : { edit: diagnostic.edit }),
    message: diagnostic.message,
  };
}
