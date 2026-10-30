import type { LoginCompletion } from '@playhoot/feature-sign-in';

// The provider's answer reaches the app as `/sign-in/complete?code=…` (or `?error=…`). The one-time
// code must never leave this browser (backend IDENTITY-ADR-0003 point 8): it is read and removed
// from the URL before anything else loads, so no later request, log or shared link carries it.
export const signInCompleteRoute = '/sign-in/complete';

let captured: LoginCompletion | null = null;

// Runs first at startup, before the app renders.
export function captureSignInCompletion(
  location: Pick<Location, 'pathname' | 'search'> = window.location,
  history: Pick<History, 'replaceState' | 'state'> = window.history,
): void {
  if (location.pathname !== signInCompleteRoute) return;
  const params = new URLSearchParams(location.search);
  captured = { code: params.get('code'), error: params.get('error') };
  history.replaceState(history.state, '', signInCompleteRoute);
}

// What this page load was opened with, if it was opened on the completion route.
export function capturedSignInCompletion(): LoginCompletion | null {
  return captured;
}
