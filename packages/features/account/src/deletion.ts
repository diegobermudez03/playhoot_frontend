import type { AppState } from '@playhoot/app-core';
import type { MeClient } from '@playhoot/communication';
import { createStore, type StoreApi } from 'zustand/vanilla';

// Ending one's own identity (P02§10-11, D-036). Access stops as the backend answers; the erasure
// itself runs on the 30/90-day clock, which is why nothing here ever says it finished.

export interface DeletionState {
  status: 'idle' | 'deleting' | 'deleted' | 'failed';
}

export interface DeletionDeps {
  app: AppState;
  me: MeClient;
  // Waits for what `leave` started to be on display. The default yields one turn of the event
  // loop, which is a rendered navigation.
  settle?: () => Promise<void>;
}

export interface Deletion {
  store: StoreApi<DeletionState>;
  // Deletes the caller's identity and forgets the credential this browser held; true once the
  // backend has taken it. `leave` is called once the backend has taken it and before the
  // credential is forgotten, so the screen can take the person somewhere that needs no
  // identity: everything built for them is rebuilt the moment they are gone, this screen
  // included. It may answer when it is done, and the credential is kept until then.
  submit(leave?: () => void | Promise<void>): Promise<boolean>;
}

const oneTurn = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export function createDeletion(deps: DeletionDeps): Deletion {
  const store = createStore<DeletionState>(() => ({ status: 'idle' }));
  return {
    store,
    async submit(leave) {
      if (store.getState().status === 'deleting') return false;
      store.setState({ status: 'deleting' });
      const result = await deps.me.deleteIdentity();
      if (!result.ok) {
        store.setState({ status: 'failed' });
        return false;
      }
      // The credential stopped working as that answer was written: holding it would only make
      // every later request fail.
      await leave?.();
      // One more turn, so the screen the person was taken to is the one on display when the
      // identity goes: every page is rebuilt for whoever is signed in the moment that changes.
      await (deps.settle ?? oneTurn)();
      deps.app.signOut();
      store.setState({ status: 'deleted' });
      return true;
    },
  };
}
