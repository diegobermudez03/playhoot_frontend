import type { DeviceCapabilities } from '@playhoot/device';

import { useDeviceCapabilities } from '../app/ServicesContext';

// The two presentation skeletons of the screens (plan §6, adaptive): `compact` for portrait or
// narrow displays (one column, things stacked), `wide` for landscape displays with room (things
// side by side). Each screen renders a whole variant for its layout; inside a variant, sizes
// adapt responsively. Chosen once at each route's edge and passed down, never asked deeper.
export type Layout = 'compact' | 'wide';

export function selectLayout(
  device: Pick<DeviceCapabilities, 'orientation' | 'displayClass'>,
): Layout {
  return device.orientation === 'landscape' && device.displayClass !== 'compact'
    ? 'wide'
    : 'compact';
}

export function useLayout(): Layout {
  return useDeviceCapabilities(selectLayout);
}
