import type {
  Draft,
  DraftChange,
  DraftChangeResult,
  DraftDiagnostic,
  DraftFileDiff,
  DraftRevision,
  GamesClient,
  GamesFailure,
} from '@playhoot/communication';
import { buildStatuses, draftRevisionsPageSize } from '@playhoot/protocol';
import { createStore, type StoreApi } from 'zustand/vanilla';

// What can be done to a draft from the workspace, one at a time.
export type AuthoringAction = 'change' | 'edit' | 'restore' | 'upload' | 'remove';

// How the last action ended, as kinds and values: presentation writes the text.
export type ActionResult =
  // `diffs`: what a change's edits did to each edited file, when it edited any.
  | { action: AuthoringAction; kind: 'applied'; revision: number; diffs?: DraftFileDiff[] }
  | { action: AuthoringAction; kind: 'unchanged'; revision: number }
  // The draft changed since the change was made: reload and redo it.
  | { action: AuthoringAction; kind: 'conflict'; currentRevision: number | null }
  | { action: AuthoringAction; kind: 'invalid'; diagnostics: DraftDiagnostic[] }
  | { action: AuthoringAction; kind: 'too-large'; diagnostics: DraftDiagnostic[] }
  | { action: AuthoringAction; kind: 'not-declared' }
  | { action: AuthoringAction; kind: 'not-editable' }
  | { action: AuthoringAction; kind: 'busy'; retryAfterSeconds: number | undefined }
  // Anything else (no answer, a server failure, an answer this client does not know): try again.
  | { action: AuthoringAction; kind: 'failed' };

export type DraftLoad =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'failed'; reason: 'not-found' | 'not-editable' | 'unavailable' };

export interface GameAuthoringState {
  gameUUID: string;
  load: DraftLoad;
  // The current revision, read with its files' content.
  draft: Draft | null;
  // The revisions read so far, newest first; null until asked for.
  revisions: DraftRevision[] | null;
  // Whether older revisions than the last one read exist and can be read.
  olderRevisions: boolean;
  busy: AuthoringAction | null;
  result: ActionResult | null;
}

export interface GameAuthoringDeps {
  games: GamesClient;
  gameUUID: string;
  newKey?: () => string;
  schedule?: (run: () => void, delayMs: number) => () => void;
}

export interface GameAuthoring {
  store: StoreApi<GameAuthoringState>;
  // Reads the draft (and follows its build while it runs).
  reload(): Promise<void>;
  loadRevisions(): Promise<void>;
  // Reads the next page of older revisions.
  loadOlderRevisions(): Promise<void>;
  // A change parsed from what the person pasted.
  applyChange(change: DraftChange): Promise<ActionResult>;
  // One file written directly, on the current revision.
  editFile(path: string, content: string): Promise<ActionResult>;
  restore(revision: number): Promise<ActionResult>;
  uploadAsset(key: string, file: File): Promise<ActionResult>;
  removeAsset(key: string): Promise<ActionResult>;
  dismissResult(): void;
  dispose(): void;
}

// How long the backend is asked to wait for a build each time, and how long to wait after a
// failed read before asking again.
const buildWaitSeconds = 20;
const buildRetryDelayMs = 3000;
const maxBuildReadFailures = 5;

const runningStatuses: readonly string[] = [buildStatuses.queued, buildStatuses.running];

export function createGameAuthoring(deps: GameAuthoringDeps): GameAuthoring {
  const newKey = deps.newKey ?? (() => crypto.randomUUID());
  const schedule =
    deps.schedule ??
    ((run, delayMs) => {
      const handle = setTimeout(run, delayMs);
      return () => clearTimeout(handle);
    });
  const { games, gameUUID } = deps;

  const store = createStore<GameAuthoringState>(() => ({
    gameUUID,
    load: { status: 'loading' },
    draft: null,
    revisions: null,
    olderRevisions: false,
    busy: null,
    result: null,
  }));

  let disposed = false;
  // Bumped by every read: a build follow that started before stops.
  let generation = 0;
  let cancelRetry: (() => void) | null = null;
  // The key of the last action that did not succeed, so retrying the same action is the same
  // request for the backend, and a different action takes a new key.
  let pendingKey: { fingerprint: string; key: string } | null = null;

  const keyFor = (fingerprint: string) => {
    if (pendingKey?.fingerprint !== fingerprint) pendingKey = { fingerprint, key: newKey() };
    return pendingKey.key;
  };

  const reload = async () => {
    const mine = ++generation;
    cancelRetry?.();
    const result = await games.readDraft(gameUUID, { content: true });
    if (disposed || mine !== generation) return;
    if (!result.ok) {
      const reason =
        result.error.kind === 'not-found'
          ? 'not-found'
          : result.error.kind === 'not-editable'
            ? 'not-editable'
            : 'unavailable';
      // A draft already shown stays through a passing failure; only a first read fails the page.
      // No version being built (the game was just published) is for good: the draft goes.
      if (reason === 'not-editable') {
        store.setState({ draft: null, revisions: null, load: { status: 'failed', reason } });
      } else if (store.getState().draft === null) {
        store.setState({ load: { status: 'failed', reason } });
      }
      return;
    }
    store.setState({ draft: result.value, load: { status: 'ready' } });
    if (store.getState().revisions !== null) void loadRevisions();
    const build = result.value.build;
    if (build && runningStatuses.includes(build.status)) {
      void followBuild(mine, result.value.currentRevision, 0);
    }
  };

  // Waits for the build of `revision` through the backend's long poll, then reads the draft again
  // so its build and last successful build are current.
  const followBuild = async (mine: number, revision: number, failures: number) => {
    const result = await games.readBuild(gameUUID, revision, buildWaitSeconds);
    if (disposed || mine !== generation) return;
    if (!result.ok) {
      if (failures + 1 >= maxBuildReadFailures) return;
      cancelRetry = schedule(
        () => void followBuild(mine, revision, failures + 1),
        buildRetryDelayMs,
      );
      return;
    }
    const draft = store.getState().draft;
    if (draft && draft.currentRevision === revision) {
      store.setState({ draft: { ...draft, build: result.value } });
    }
    if (runningStatuses.includes(result.value.status)) {
      void followBuild(mine, revision, 0);
      return;
    }
    void reload();
  };

  const loadRevisions = async () => {
    const result = await games.listRevisions(gameUUID);
    if (disposed || !result.ok) return;
    store.setState({
      revisions: result.value,
      olderRevisions: hasOlder(result.value),
    });
  };

  const loadOlderRevisions = async () => {
    const read = store.getState().revisions;
    const oldest = read?.[read.length - 1];
    if (!read || !oldest) return;
    const result = await games.listRevisions(gameUUID, oldest.number);
    // A newer read of the first page replaced the list meanwhile: this page belongs to it no more.
    if (disposed || !result.ok || store.getState().revisions !== read) return;
    store.setState({
      revisions: [...read, ...result.value],
      olderRevisions: hasOlder(result.value),
    });
  };

  const run = async (
    action: AuthoringAction,
    fingerprint: string,
    call: (
      key: string,
    ) => Promise<{ ok: true; value: DraftChangeResult } | { ok: false; error: GamesFailure }>,
  ): Promise<ActionResult> => {
    store.setState({ busy: action, result: null });
    const key = keyFor(`${action}:${fingerprint}`);
    const answer = await call(key);
    const result = actionResult(action, answer);
    if (result.kind === 'applied' || result.kind === 'unchanged') pendingKey = null;
    if (!disposed) store.setState({ busy: null, result });
    if (!disposed && result.kind === 'applied') await reload();
    return result;
  };

  const currentRevision = () => store.getState().draft?.currentRevision ?? 0;

  return {
    store,
    reload,
    loadRevisions,
    loadOlderRevisions,
    applyChange: (change) =>
      run('change', JSON.stringify(change), (key) => games.applyChange(gameUUID, change, key)),
    editFile: (path, content) => {
      const change: DraftChange = {
        baseRevision: currentRevision(),
        files: [{ path, content }],
        delete: [],
      };
      return run('edit', JSON.stringify(change), (key) => games.applyChange(gameUUID, change, key));
    },
    restore: (revision) => {
      const base = currentRevision();
      return run('restore', `${revision}@${base}`, (key) =>
        games.restoreRevision(gameUUID, revision, base, key),
      );
    },
    uploadAsset: (key, file) =>
      run('upload', `${key}:${file.name}:${file.size}:${file.lastModified}`, (idempotencyKey) =>
        games.uploadAsset(gameUUID, key, file, idempotencyKey),
      ),
    removeAsset: (key) =>
      run('remove', `${key}@${currentRevision()}`, (idempotencyKey) =>
        games.removeAsset(gameUUID, key, idempotencyKey),
      ),
    dismissResult: () => store.setState({ result: null }),
    dispose: () => {
      disposed = true;
      generation++;
      cancelRetry?.();
    },
  };
}

function actionResult(
  action: AuthoringAction,
  answer: { ok: true; value: DraftChangeResult } | { ok: false; error: GamesFailure },
): ActionResult {
  if (answer.ok) {
    const { outcome, revision, diffs } = answer.value;
    // `applied`, `attached` and `removed` made a revision; `unchanged` did not. An outcome this
    // client does not know is read by whether the revision moved, which the reload shows.
    if (outcome === 'unchanged') return { action, kind: 'unchanged', revision };
    return diffs && diffs.length > 0
      ? { action, kind: 'applied', revision, diffs }
      : { action, kind: 'applied', revision };
  }
  const failure = answer.error;
  switch (failure.kind) {
    case 'conflict':
      return { action, kind: 'conflict', currentRevision: failure.currentRevision };
    case 'invalid':
      return { action, kind: 'invalid', diagnostics: failure.diagnostics };
    case 'too-large':
      return { action, kind: 'too-large', diagnostics: failure.diagnostics };
    case 'not-declared':
      return { action, kind: 'not-declared' };
    case 'not-editable':
      return { action, kind: 'not-editable' };
    case 'busy':
      return { action, kind: 'busy', retryAfterSeconds: failure.retryAfterSeconds };
    default:
      return { action, kind: 'failed' };
  }
}

// A full page may have older revisions after it; a shorter one is the end of the history, as is
// a page ending at revision 1.
const hasOlder = (page: DraftRevision[]): boolean =>
  page.length === draftRevisionsPageSize && page[page.length - 1]?.number !== 1;
