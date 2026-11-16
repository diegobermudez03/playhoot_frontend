import { useSyncExternalStore, type ReactNode } from 'react';

const subscribe = () => () => {};
const onServer = () => false;
const onClient = () => true;

// Renders its children only once the page is interactive. The server and the first client render
// agree (nothing), so hydration never mismatches; the subtree appears in the same commit that
// hydration finishes.
export function ClientOnly({ children }: { children: ReactNode }) {
  const hydrated = useSyncExternalStore(subscribe, onClient, onServer);
  return hydrated ? <>{children}</> : null;
}
