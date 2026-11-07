import type {
  GamesClient,
  TemplateDetails,
  TemplateEntry,
  TemplatePage,
  TemplateQuery,
} from '@playhoot/communication';
import { createStore, type StoreApi } from 'zustand/vanilla';

// Finding a template to start a game from: the featured ones and the categories first, a search
// by words, category and players, and one template inspected before choosing it. An empty
// catalog is a normal answer: then only the starter project is offered.

export interface TemplateBrowserState {
  status: 'loading' | 'ready' | 'failed';
  featured: TemplateEntry[];
  categories: { name: string; templates: number }[];
  // The last search: what was asked and what came back (null until one is asked).
  search: {
    query: TemplateQuery;
    status: 'loading' | 'done' | 'failed';
    page: TemplatePage | null;
  } | null;
  // The template being inspected, null when none.
  inspected: {
    gameUUID: string;
    status: 'loading' | 'done' | 'failed';
    details: TemplateDetails | null;
  } | null;
}

export interface TemplateBrowser {
  store: StoreApi<TemplateBrowserState>;
  load(): Promise<void>;
  // Runs a search; a newer one replaces it.
  search(query: TemplateQuery): Promise<void>;
  // Inspects one template; a newer inspection replaces it.
  inspect(templateGameUUID: string): Promise<void>;
  closeInspection(): void;
  dispose(): void;
}

export function createTemplateBrowser(deps: { games: GamesClient }): TemplateBrowser {
  const { games } = deps;
  const store = createStore<TemplateBrowserState>(() => ({
    status: 'loading',
    featured: [],
    categories: [],
    search: null,
    inspected: null,
  }));
  let disposed = false;

  return {
    store,
    async load() {
      store.setState({ status: 'loading' });
      const result = await games.browseTemplates();
      if (disposed) return;
      store.setState(
        result.ok
          ? {
              status: 'ready',
              featured: result.value.featured,
              categories: result.value.categories,
            }
          : { status: 'failed' },
      );
    },
    async search(query) {
      const search = { query, status: 'loading' as const, page: null };
      store.setState({ search });
      const result = await games.searchTemplates(query);
      if (disposed || store.getState().search !== search) return;
      store.setState({
        search: result.ok
          ? { query, status: 'done', page: result.value }
          : { query, status: 'failed', page: null },
      });
    },
    async inspect(templateGameUUID) {
      const inspected = { gameUUID: templateGameUUID, status: 'loading' as const, details: null };
      store.setState({ inspected });
      const result = await games.inspectTemplate(templateGameUUID);
      if (disposed || store.getState().inspected !== inspected) return;
      store.setState({
        inspected: result.ok
          ? { gameUUID: templateGameUUID, status: 'done', details: result.value }
          : { gameUUID: templateGameUUID, status: 'failed', details: null },
      });
    },
    closeInspection: () => store.setState({ inspected: null }),
    dispose: () => {
      disposed = true;
    },
  };
}
