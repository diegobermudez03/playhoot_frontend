import { describe, expect, it } from 'vitest';

import { createAdminSession } from './adminSession';

const token = (seconds: number) => ({
  purpose: 'admin_token',
  user_uuid: 'admin-uuid',
  level: 'admin',
  access_token: 'admin-token',
  access_expires_at: new Date().toISOString(),
  access_expires_in: seconds,
});

describe('createAdminSession', () => {
  it('holds the token in memory only and reports admin mode', () => {
    const session = createAdminSession({ now: () => 0, schedule: () => () => undefined });
    expect(session.credentials.currentToken()).toBeNull();
    session.hold(token(900));
    expect(session.credentials.currentToken()).toBe('admin-token');
    expect(session.store.getState()).toEqual({
      status: 'active',
      userUUID: 'admin-uuid',
      expiresAt: 900_000,
    });
    // The store never carries the token itself.
    expect(JSON.stringify(session.store.getState())).not.toContain('admin-token');
  });

  it('stops attaching a token that is about to lapse', () => {
    let clock = 0;
    const session = createAdminSession({ now: () => clock, schedule: () => () => undefined });
    session.hold(token(10));
    clock = 7_000;
    expect(session.credentials.currentToken()).toBe('admin-token');
    clock = 9_000;
    expect(session.credentials.currentToken()).toBeNull();
  });

  it('leaves admin mode when the token lapses', () => {
    let lapse: (() => void) | null = null;
    const session = createAdminSession({
      now: () => 0,
      schedule: (run) => {
        lapse = run;
        return () => undefined;
      },
    });
    session.hold(token(900));
    lapse!();
    expect(session.store.getState().status).toBe('none');
    expect(session.credentials.currentToken()).toBeNull();
  });

  it('forgets the token when admin mode is left on purpose', () => {
    const session = createAdminSession({ now: () => 0, schedule: () => () => undefined });
    session.hold(token(900));
    session.release();
    expect(session.store.getState()).toEqual({ status: 'none', userUUID: null, expiresAt: null });
    expect(session.credentials.currentToken()).toBeNull();
  });
});
