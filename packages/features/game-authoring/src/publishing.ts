import type {
  GameCard,
  GamesClient,
  GamesFailure,
  Publication,
  PublishBlocker,
} from '@playhoot/communication';
import { createStore, type StoreApi } from 'zustand/vanilla';

// "Ficha y publicación": the game's card (name, description, logo, discovery photos) and its
// publication. Publishing takes only the draft's current revision; a published game without an
// open edition is changed again by opening a new edition.

export type CardAction =
  'save' | 'logo' | 'remove-logo' | 'photo' | 'remove-photo' | 'publish' | 'edition';

export type CardLoad =
  | { status: 'loading' }
  | { status: 'ready'; card: GameCard }
  | { status: 'failed'; reason: 'not-found' | 'unavailable' };

// What the last action ended in, to tell the person.
export type CardNotice =
  | { kind: 'saved' }
  | { kind: 'published'; publication: Publication }
  | { kind: 'edition-opened'; revision: number }
  | { kind: 'not-ready'; blockers: PublishBlocker[] }
  | { kind: 'failed'; action: CardAction; failure: GamesFailure };

export interface CardState {
  load: CardLoad;
  busy: CardAction | null;
  notice: CardNotice | null;
}

export interface GamePublishing {
  store: StoreApi<CardState>;
  load(): Promise<void>;
  save(change: { name?: string; description?: string }): Promise<boolean>;
  uploadLogo(file: Blob): Promise<void>;
  removeLogo(): Promise<void>;
  uploadPhoto(file: Blob): Promise<void>;
  removePhoto(photoUUID: string): Promise<void>;
  // Publishes the current revision; `name` confirms or replaces the card's name first.
  publish(request: { visibility: string; name?: string }): Promise<boolean>;
  // Opens a new edition of the published game, whose draft starts from the published sources.
  openEdition(): Promise<boolean>;
  dismissNotice(): void;
  dispose(): void;
}

export function createGamePublishing(deps: {
  games: GamesClient;
  gameUUID: string;
}): GamePublishing {
  const { games, gameUUID } = deps;
  const store = createStore<CardState>(() => ({
    load: { status: 'loading' },
    busy: null,
    notice: null,
  }));
  let disposed = false;
  // A retry of the same action resends its key; a different action takes a new one.
  const keys = new Map<string, string>();
  const keyFor = (action: string) => {
    let key = keys.get(action);
    if (!key) {
      key = crypto.randomUUID();
      keys.set(action, key);
    }
    return key;
  };
  // Each picked file is its own upload, keyed once.
  const fileKeys = new WeakMap<Blob, string>();
  const keyForFile = (file: Blob) => {
    let key = fileKeys.get(file);
    if (!key) {
      key = crypto.randomUUID();
      fileKeys.set(file, key);
    }
    return key;
  };

  const load = async () => {
    const result = await games.readCard(gameUUID);
    if (disposed) return;
    store.setState({
      load: result.ok
        ? { status: 'ready', card: result.value }
        : {
            status: 'failed',
            reason: result.error.kind === 'not-found' ? 'not-found' : 'unavailable',
          },
    });
  };

  // Runs one action, then reads the card again whatever it ended in.
  const run = async <T>(
    action: CardAction,
    call: () => Promise<{ ok: true; value: T } | { ok: false; error: GamesFailure }>,
    onDone: (value: T) => CardNotice | null,
  ): Promise<boolean> => {
    if (store.getState().busy) return false;
    store.setState({ busy: action, notice: null });
    const result = await call();
    if (disposed) return false;
    if (result.ok) {
      store.setState({ busy: null, notice: onDone(result.value) });
    } else if (result.error.kind === 'not-ready') {
      store.setState({
        busy: null,
        notice: { kind: 'not-ready', blockers: result.error.blockers },
      });
    } else {
      store.setState({ busy: null, notice: { kind: 'failed', action, failure: result.error } });
    }
    await load();
    return result.ok;
  };

  return {
    store,
    load,
    save: (change) =>
      run(
        'save',
        () => games.updateCard(gameUUID, change),
        () => ({ kind: 'saved' }),
      ),
    async uploadLogo(file) {
      await run(
        'logo',
        () => games.uploadLogo(gameUUID, file, keyForFile(file)),
        () => null,
      );
    },
    async removeLogo() {
      await run(
        'remove-logo',
        () => games.removeLogo(gameUUID),
        () => null,
      );
    },
    async uploadPhoto(file) {
      await run(
        'photo',
        () => games.uploadPhoto(gameUUID, file, keyForFile(file)),
        () => null,
      );
    },
    async removePhoto(photoUUID) {
      await run(
        'remove-photo',
        () => games.removePhoto(gameUUID, photoUUID),
        () => null,
      );
    },
    async publish(request) {
      const signature = `publish:${request.visibility}:${request.name ?? ''}`;
      const published = await run(
        'publish',
        () => games.publish(gameUUID, request, keyFor(signature)),
        (publication) => ({ kind: 'published', publication }),
      );
      // A publication answered (or refused for good) frees its key for the next one.
      if (published || store.getState().notice?.kind === 'not-ready') keys.delete(signature);
      return published;
    },
    async openEdition() {
      const opened = await run(
        'edition',
        () => games.openEdition(gameUUID, keyFor('edition')),
        (edition) => ({ kind: 'edition-opened', revision: edition.revision }),
      );
      if (opened) keys.delete('edition');
      return opened;
    },
    dismissNotice: () => store.setState({ notice: null }),
    dispose: () => {
      disposed = true;
    },
  };
}
