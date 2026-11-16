import { useEffect, useSyncExternalStore, type ReactNode } from 'react';

import { silentSoundPlayer, SoundProvider } from '../sound';
import { clientServices } from './clientServices';
import { ServicesProvider } from './ServicesContext';
import { startServices } from './services';

const subscribe = () => () => {};
const onServer = () => false;
const onClient = () => true;

// Where the app's services enter the tree, above the router. They read storage, the credential
// and the device, so they exist only in the browser: until the page is interactive every piece
// that needs them sees none and renders nothing (`useOptionalServices`). A server-rendered public
// page is therefore the same page as an app one, with the same shell, and there is one set of
// services for the whole visit.
export function ServicesBoundary({ children }: { children: ReactNode }) {
  const hydrated = useSyncExternalStore(subscribe, onClient, onServer);
  const services = hydrated ? clientServices() : null;

  useEffect(() => {
    if (!services) return;
    return startServices(services);
  }, [services]);

  return (
    <ServicesProvider services={services}>
      <SoundProvider player={services?.sound ?? silentSoundPlayer}>{children}</SoundProvider>
    </ServicesProvider>
  );
}
