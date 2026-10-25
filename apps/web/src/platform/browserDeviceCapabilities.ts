import {
  classifyDevice,
  classifyDisplay,
  type DeviceCapabilities,
  type DeviceCapabilitiesStore,
} from '@playhoot/device';

// Web adapter for DeviceCapabilities. Keyboard presence cannot be detected in a browser: it is
// assumed whenever a fine pointer exists (desktop-like), which is wrong for tablets with keyboards
// and acceptable until a business flow needs better.
export function detectBrowserCapabilities(): DeviceCapabilities {
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const pointer = window.matchMedia('(any-pointer: fine)').matches
    ? 'fine'
    : window.matchMedia('(any-pointer: coarse)').matches
      ? 'coarse'
      : 'none';
  return {
    touch: navigator.maxTouchPoints > 0,
    keyboard: pointer === 'fine',
    pointer,
    gamepad: (navigator.getGamepads?.() ?? []).some((pad) => pad !== null),
    viewport,
    ...classifyDisplay(viewport),
    deviceClass: classifyDevice({
      // Chromium browsers say it directly; others fall back to the primary pointer.
      platformSaysMobile: (navigator as { userAgentData?: { mobile?: boolean } }).userAgentData
        ?.mobile,
      primaryPointerCoarse: window.matchMedia('(pointer: coarse)').matches,
      primaryPointerHovers: window.matchMedia('(hover: hover)').matches,
    }),
  };
}

// Keeps the store current while the app runs. Returns a function that stops listening.
export function watchBrowserCapabilities(store: DeviceCapabilitiesStore): () => void {
  const refresh = () => store.setState(detectBrowserCapabilities(), true);
  const queries = [
    '(any-pointer: fine)',
    '(any-pointer: coarse)',
    '(pointer: coarse)',
    '(hover: hover)',
  ].map((q) => window.matchMedia(q));
  const windowEvents = ['resize', 'orientationchange', 'gamepadconnected', 'gamepaddisconnected'];

  windowEvents.forEach((event) => window.addEventListener(event, refresh));
  queries.forEach((query) => query.addEventListener('change', refresh));
  refresh();

  return () => {
    windowEvents.forEach((event) => window.removeEventListener(event, refresh));
    queries.forEach((query) => query.removeEventListener('change', refresh));
  };
}
