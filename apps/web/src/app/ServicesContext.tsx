import { operationAccess, type AuthSnapshot, type OperationAccess } from '@playhoot/app-core';
import type { DeviceCapabilities } from '@playhoot/device';
import { createContext, useContext, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

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

// Whether the person may go ahead with `operation`, per the backend's catalog. UX only.
export function useOperationAccess(operation: string): OperationAccess {
  const { auth, operations } = useStore(
    useServices().app.store,
    useShallow((state) => ({ auth: state.auth, operations: state.operations })),
  );
  return operationAccess(auth, operations, operation);
}

export function useDeviceCapabilities(): DeviceCapabilities;
export function useDeviceCapabilities<T>(select: (capabilities: DeviceCapabilities) => T): T;
export function useDeviceCapabilities(select?: (capabilities: DeviceCapabilities) => unknown) {
  return useStore(
    useServices().device,
    select ?? ((capabilities: DeviceCapabilities) => capabilities),
  );
}
