import type { AuthSnapshot } from '@playhoot/app-core';
import type { DeviceCapabilities } from '@playhoot/device';
import { createContext, useContext, type ReactNode } from 'react';
import { useStore } from 'zustand';

import type { Services } from './services';

const ServicesContext = createContext<Services | null>(null);

export function ServicesProvider({
  services,
  children,
}: {
  services: Services;
  children: ReactNode;
}) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('useServices must be used inside <ServicesProvider>');
  return services;
}

export function useAuth(): AuthSnapshot {
  return useStore(useServices().app.store, (state) => state.auth);
}

export function useDeviceCapabilities(): DeviceCapabilities;
export function useDeviceCapabilities<T>(select: (capabilities: DeviceCapabilities) => T): T;
export function useDeviceCapabilities(select?: (capabilities: DeviceCapabilities) => unknown) {
  return useStore(
    useServices().device,
    select ?? ((capabilities: DeviceCapabilities) => capabilities),
  );
}
