import type { AiLinkStatus, GamesClient } from '@playhoot/communication';
import { createStore, type StoreApi } from 'zustand/vanilla';

// "Compartir con mi IA": the game's link for the creator's AI. The link's secret URL is answered
// only when created, so it lives in this store's memory until the person leaves the section: never
// in storage nor in the page URL.

export type AiLinkAction = 'create' | 'revoke';

export type AiLinkLoad =
  { status: 'loading' } | { status: 'ready'; link: AiLinkStatus } | { status: 'failed' };

export interface AiLinkState {
  load: AiLinkLoad;
  // The URL just created, shown once.
  created: { url: string; expiresAt: string } | null;
  busy: AiLinkAction | null;
  // The last action that did not work, to tell the person.
  failed: AiLinkAction | null;
}

export interface AiLinkSharing {
  store: StoreApi<AiLinkState>;
  load(): Promise<void>;
  // Creates the link, or a new one replacing the active one.
  create(): Promise<void>;
  revoke(): Promise<void>;
  // Forgets the URL shown once.
  forgetCreated(): void;
  dispose(): void;
}

export function createAiLinkSharing(deps: { games: GamesClient; gameUUID: string }): AiLinkSharing {
  const { games, gameUUID } = deps;
  const store = createStore<AiLinkState>(() => ({
    load: { status: 'loading' },
    created: null,
    busy: null,
    failed: null,
  }));
  let disposed = false;

  const load = async () => {
    const result = await games.readAiLink(gameUUID);
    if (disposed) return;
    store.setState({
      load: result.ok ? { status: 'ready', link: result.value } : { status: 'failed' },
    });
  };

  return {
    store,
    load,
    async create() {
      store.setState({ busy: 'create', failed: null, created: null });
      const result = await games.createAiLink(gameUUID);
      if (disposed) return;
      if (!result.ok) {
        store.setState({ busy: null, failed: 'create' });
        return;
      }
      store.setState({
        busy: null,
        created: { url: result.value.url, expiresAt: result.value.expiresAt },
      });
      await load();
    },
    async revoke() {
      store.setState({ busy: 'revoke', failed: null });
      const result = await games.revokeAiLink(gameUUID);
      if (disposed) return;
      store.setState({
        busy: null,
        created: null,
        ...(!result.ok && { failed: 'revoke' as const }),
      });
      await load();
    },
    forgetCreated: () => store.setState({ created: null }),
    dispose: () => {
      disposed = true;
      store.setState({ created: null });
    },
  };
}
