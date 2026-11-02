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
  draftChangesPath,
  draftPath,
  draftRefusalSchema,
  draftResponseSchema,
  draftRestorePath,
  draftRevisionsPath,
  draftRevisionsResponseSchema,
  buildSchema,
  gamesErrorCodes,
  maxBuildWaitSeconds,
  projectChangeFormat,
  rateLimitedCode,
  type BuildResponse,
  type CreateGameRequest,
  type DraftChangeResponse,
  type DraftResponse,
  type ProjectChangeRequest,
  type RestoreRevisionRequest,
} from '@playhoot/protocol';

import type { Decoder, HttpClient, HttpFailure } from './http';
import { err, ok, type Result } from './result';

// Game authoring over REST (backend `api/games`). Every string the backend lists (statuses,
// outcomes, stages, kinds) stays a string: known values are in `@playhoot/protocol`.

export interface CreatedGame {
  gameUUID: string;
  versionUUID: string;
  revision: number;
}

export interface DraftDiagnostic {
  path: string;
  code: string;
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

export interface DraftRevision {
  number: number;
  source: string;
  files: number;
  createdAt: string;
}

export interface DraftChange {
  baseRevision: number;
  files: { path: string; content: string }[];
  delete: string[];
}

// What a change, restore, upload or removal answered. `outcome` is `applied`, `unchanged`,
// `attached` or `removed`, or one this client does not know.
export interface DraftChangeResult {
  outcome: string;
  revision: number;
  // The build of `revision` as just queued, when a revision was made.
  buildStatus: string | null;
  asset: DraftAsset | null;
}

// A link for the creator's AI, as created: `url` holds the secret token and is never answered again.
export interface CreatedAiLink {
  url: string;
  expiresAt: string;
}

// Whether the game has an active link for the creator's AI, without its secret.
export interface AiLinkStatus {
  active: boolean;
  createdAt: string | null;
  expiresAt: string | null;
}

// Why a games call did not do what it asked, by what the caller can do about it.
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
  // Too many requests or uploads right now: try again after `retryAfterSeconds`.
  | { kind: 'busy'; retryAfterSeconds: number | undefined }
  // Anything else: no answer, a server failure, an unknown refusal or an unexpected body.
  | { kind: 'unavailable'; failure: HttpFailure };

export interface GamesClient {
  createGame(idempotencyKey: string): Promise<Result<CreatedGame, GamesFailure>>;
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
  listRevisions(gameUUID: string): Promise<Result<DraftRevision[], GamesFailure>>;
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
}

export function createGamesClient(http: HttpClient): GamesClient {
  return {
    async createGame(idempotencyKey) {
      const body: CreateGameRequest = { idempotency_key: idempotencyKey };
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

    async listRevisions(gameUUID) {
      const result = await http.request({
        method: 'GET',
        path: draftRevisionsPath(gameUUID),
        response: draftRevisionsResponseSchema,
      });
      if (!result.ok) return err(gamesFailure(result.error));
      return ok(
        result.value.map((revision) => ({
          number: revision.number,
          source: revision.source,
          files: revision.files,
          createdAt: revision.created_at,
        })),
      );
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
  };
}

// Revoking answers 204 without a body.
const noBody: Decoder<unknown> = { safeParse: (value) => ({ success: true, data: value }) };

function changeResult(
  result: Result<DraftChangeResponse, HttpFailure>,
): Result<DraftChangeResult, GamesFailure> {
  if (!result.ok) return err(gamesFailure(result.error));
  return ok({
    outcome: result.value.outcome,
    revision: result.value.revision,
    buildStatus: result.value.build?.status ?? null,
    asset: result.value.asset ? assetOf(result.value.asset) : null,
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
    case gamesErrorCodes.uploadsBusy:
    case rateLimitedCode:
      return { kind: 'busy', retryAfterSeconds: failure.retryAfterSeconds };
  }
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

function diagnosticOf(diagnostic: { path: string; code: string; message: string }) {
  return { path: diagnostic.path, code: diagnostic.code, message: diagnostic.message };
}
