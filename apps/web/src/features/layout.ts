import { displayClassBreakpoints, type DeviceCapabilities } from '@playhoot/device';
import { useSyncExternalStore } from 'react';

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

// The same choice for a page the server renders, which knows nothing about the display and has
// no services behind it (a public page, D-019). It answers `compact` on the server and on the
// first client render, so hydration never mismatches, and the real answer right after.
const wideQuery = `(min-width: ${displayClassBreakpoints.medium}px) and (orientation: landscape)`;

export function useMediaLayout(): Layout {
  return useSyncExternalStore(subscribeToWide, readWide, () => 'compact' as Layout);
}

function subscribeToWide(onChange: () => void): () => void {
  const query = window.matchMedia(wideQuery);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function readWide(): Layout {
  return window.matchMedia(wideQuery).matches ? 'wide' : 'compact';
}
