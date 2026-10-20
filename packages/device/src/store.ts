import { createStore, type StoreApi } from 'zustand/vanilla';

import type { DeviceCapabilities } from './capabilities';

// Holds the current capabilities. A platform adapter detects them and keeps the store current;
// presentation and features only read and subscribe.
export type DeviceCapabilitiesStore = StoreApi<DeviceCapabilities>;

export function createDeviceCapabilitiesStore(
  initial: DeviceCapabilities,
): DeviceCapabilitiesStore {
  return createStore<DeviceCapabilities>(() => initial);
}
