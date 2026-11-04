import type {
  AiAccessClient,
  AiAuthorizationRequest,
  AiConnection,
  GamesClient,
  MyGame,
} from '@playhoot/communication';
import { createStore, type StoreApi } from 'zustand/vanilla';

// The account's side of its games and AI apps: "Mis juegos", the consent an AI app asks for, and
// "IAs conectadas". Tokens never pass through here: deciding only answers where the browser goes.

export type ListLoad<T> =
  { status: 'loading' } | { status: 'ready'; items: T[] } | { status: 'failed' };

export interface MyGamesState {
  load: ListLoad<MyGame>;
}

export interface MyGamesList {
  store: StoreApi<MyGamesState>;
  load(): Promise<void>;
  dispose(): void;
}

export function createMyGamesList(deps: { games: GamesClient }): MyGamesList {
  const store = createStore<MyGamesState>(() => ({ load: { status: 'loading' } }));
  let disposed = false;
  return {
    store,
    async load() {
      store.setState({ load: { status: 'loading' } });
      const result = await deps.games.listGames();
      if (disposed) return;
      store.setState({
        load: result.ok ? { status: 'ready', items: result.value } : { status: 'failed' },
      });
    },
    dispose: () => {
      disposed = true;
    },
  };
}

export type ConsentDecision = 'approve' | 'deny';

export type ConsentState =
  | { status: 'loading' }
  | {
      status: 'ready';
      request: AiAuthorizationRequest;
      deciding: ConsentDecision | null;
      failed: boolean;
    }
  // The request does not exist, expired or was already decided.
  | { status: 'gone' }
  | { status: 'failed' }
  // Decided: the browser goes to `redirectURL` (the AI app's).
  | { status: 'decided'; redirectURL: string };

export interface AiConsent {
  store: StoreApi<ConsentState>;
  load(): Promise<void>;
  decide(decision: ConsentDecision): Promise<void>;
  dispose(): void;
}

export function createAiConsent(deps: { access: AiAccessClient; requestID: string }): AiConsent {
  const { access, requestID } = deps;
  const store = createStore<ConsentState>(() => ({ status: 'loading' }));
  // Each status replaces the previous one whole: they share no fields.
  const set = (state: ConsentState) => store.setState(state, true);
  let disposed = false;
  return {
    store,
    async load() {
      set({ status: 'loading' });
      const result = await access.readAuthorization(requestID);
      if (disposed) return;
      if (result.ok) {
        set({ status: 'ready', request: result.value, deciding: null, failed: false });
        return;
      }
      set({ status: result.error.kind === 'not-found' ? 'gone' : 'failed' });
    },
    async decide(decision) {
      const current = store.getState();
      if (current.status !== 'ready' || current.deciding) return;
      set({ ...current, deciding: decision, failed: false });
      const result =
        decision === 'approve'
          ? await access.approveAuthorization(requestID)
          : await access.denyAuthorization(requestID);
      if (disposed) return;
      if (result.ok) {
        set({ status: 'decided', redirectURL: result.value });
        return;
      }
      if (result.error.kind === 'not-found') {
        set({ status: 'gone' });
        return;
      }
      set({ ...current, deciding: null, failed: true });
    },
    dispose: () => {
      disposed = true;
    },
  };
}

export interface AiConnectionsState {
  load: ListLoad<AiConnection>;
  // The connection being revoked, and whether the last revocation failed.
  revoking: string | null;
  revokeFailed: boolean;
}

export interface AiConnectionsList {
  store: StoreApi<AiConnectionsState>;
  load(): Promise<void>;
  revoke(connectionID: string): Promise<void>;
  dispose(): void;
}

export function createAiConnectionsList(deps: { access: AiAccessClient }): AiConnectionsList {
  const store = createStore<AiConnectionsState>(() => ({
    load: { status: 'loading' },
    revoking: null,
    revokeFailed: false,
  }));
  let disposed = false;
  const load = async () => {
    const result = await deps.access.listConnections();
    if (disposed) return;
    store.setState({
      load: result.ok ? { status: 'ready', items: result.value } : { status: 'failed' },
    });
  };
  return {
    store,
    load,
    async revoke(connectionID) {
      if (store.getState().revoking) return;
      store.setState({ revoking: connectionID, revokeFailed: false });
      const result = await deps.access.revokeConnection(connectionID);
      if (disposed) return;
      // An unknown connection is already gone: the list read again shows it.
      const failed = !result.ok && result.error.kind !== 'not-found';
      store.setState({ revoking: null, revokeFailed: failed });
      await load();
    },
    dispose: () => {
      disposed = true;
    },
  };
}
