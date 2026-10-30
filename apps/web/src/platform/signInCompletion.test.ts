import { describe, expect, it, vi } from 'vitest';

import { captureSignInCompletion, capturedSignInCompletion } from './signInCompletion';

describe('captureSignInCompletion', () => {
  it('keeps the code and removes it from the URL', () => {
    const history = { state: { idx: 0 }, replaceState: vi.fn() };

    captureSignInCompletion({ pathname: '/sign-in/complete', search: '?code=phl_x' }, history);

    expect(capturedSignInCompletion()).toEqual({ code: 'phl_x', error: null });
    expect(history.replaceState).toHaveBeenCalledWith({ idx: 0 }, '', '/sign-in/complete');
  });

  it('leaves any other page alone', () => {
    const history = { state: null, replaceState: vi.fn() };
    captureSignInCompletion({ pathname: '/join', search: '?code=ABC234' }, history);
    expect(history.replaceState).not.toHaveBeenCalled();
  });
});
