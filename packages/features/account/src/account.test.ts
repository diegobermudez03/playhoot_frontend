import {
  createAppState,
  type AppState,
  type Credential,
  type CredentialStore,
} from '@playhoot/app-core';
import type { HttpFailure, IdentityClient, MeClient, MyData } from '@playhoot/communication';
import { describe, expect, it, vi } from 'vitest';

import { createDeletion } from './deletion';
import { createMyData } from './myData';
import { createSignInMethods } from './signInMethods';

const ok = <T>(value: T) => ({ ok: true as const, value });
const err = <E>(error: E) => ({ ok: false as const, error });

const httpError = (status: number, code?: string, body?: unknown): HttpFailure => ({
  kind: 'http',
  status,
  code,
  message: 'refused',
  retryAfterSeconds: undefined,
  ...(body !== undefined && { body }),
});

const myData: MyData = {
  profile: {
    userUUID: 'u-1',
    displayName: 'Ana',
    level: 'account',
    mode: 'normal',
    language: 'en',
    methods: [],
  },
  declarationKnown: true,
  declaration: null,
  limitsKnown: false,
  limits: null,
};

function appState(): { app: AppState; stored: () => Credential | null } {
  let saved: Credential | null = null;
  const credentials: CredentialStore = {
    load: () => saved,
    save: (credential) => {
      saved = credential;
    },
    clear: () => {
      saved = null;
    },
  };
  const app = createAppState({
    credentials,
    locale: { store: { load: () => null, save: () => undefined }, devicePreferences: () => [] },
  });
  app.bootstrap();
  app.signIn({
    token: 'a-1',
    refreshToken: 'r-1',
    userUUID: 'u-1',
    kind: 'account',
    displayName: 'Ana',
    mode: 'normal',
  });
  return { app, stored: () => saved };
}

function meClient(overrides: Partial<MeClient> = {}): MeClient {
  return {
    readMyData: vi.fn(async () => ok(myData)),
    setMode: vi.fn(async (mode: string) =>
      ok({ mode, access: { token: 'a-2', expiresAt: undefined, mode } }),
    ),
    setLanguage: vi.fn(async (language: string) => ok(language)),
    deleteIdentity: vi.fn(async () => ok(undefined)),
    ...overrides,
  };
}

function identityClient(overrides: Partial<IdentityClient> = {}): IdentityClient {
  return {
    createGuest: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
    listOperations: vi.fn(),
    setDisplayName: vi.fn(async (name: string) => ok(name)),
    listLoginProviders: vi.fn(),
    startLogin: vi.fn(),
    completeLogin: vi.fn(),
    startEmailLogin: vi.fn(),
    completeEmailLogin: vi.fn(),
    startLinkProvider: vi.fn(),
    completeLinkProvider: vi.fn(),
    listSignInMethods: vi.fn(async () => ok([])),
    startLinkEmail: vi.fn(async () => ok(undefined)),
    completeLinkEmail: vi.fn(async () => ok(undefined)),
    removeSignInMethod: vi.fn(async () => ok(undefined)),
    ...overrides,
  } as IdentityClient;
}

describe('createMyData', () => {
  it('reads the composed answer once however often it is asked', async () => {
    const me = meClient();
    const feature = createMyData({ ...appState(), me, identity: identityClient() });

    await Promise.all([feature.load(), feature.load()]);

    expect(me.readMyData).toHaveBeenCalledTimes(1);
    expect(feature.store.getState()).toMatchObject({ status: 'ready', data: myData });
  });

  it('keeps what was already read when a reread fails', async () => {
    const readMyData = vi
      .fn()
      .mockResolvedValueOnce(ok(myData))
      .mockResolvedValueOnce(err({ kind: 'unavailable' as const, failure: httpError(503) }));
    const feature = createMyData({
      ...appState(),
      me: meClient({ readMyData }),
      identity: identityClient(),
    });

    await feature.load();
    await feature.load();

    expect(feature.store.getState()).toMatchObject({
      status: 'failed',
      data: myData,
      error: { kind: 'unavailable' },
    });
  });

  it('says when the next name change is possible instead of only refusing', async () => {
    const identity = identityClient({
      setDisplayName: vi.fn(async () =>
        err(httpError(429, 'change_limit_reached', { next_change_at: '2026-12-16T10:00:00Z' })),
      ),
    });
    const feature = createMyData({ ...appState(), me: meClient(), identity });

    expect(await feature.rename('Bea')).toBe(false);
    expect(feature.store.getState().renameError).toEqual({
      kind: 'limit-reached',
      nextChangeAt: '2026-12-16T10:00:00Z',
    });
  });

  it('refuses a name that is empty or too long without asking the backend', async () => {
    const identity = identityClient();
    const feature = createMyData({ ...appState(), me: meClient(), identity });

    expect(await feature.rename('   ')).toBe(false);

    expect(identity.setDisplayName).not.toHaveBeenCalled();
    expect(feature.store.getState().renameError).toMatchObject({ kind: 'invalid' });
  });

  it('adopts the access token a mode switch answers, so the next request is a teacher request', async () => {
    const state = appState();
    const feature = createMyData({ ...state, me: meClient(), identity: identityClient() });
    await feature.load();

    expect(await feature.setMode('teacher')).toBe(true);

    expect(state.app.credentials.currentToken()).toBe('a-2');
    expect(state.app.store.getState().auth).toMatchObject({ mode: 'teacher' });
    expect(feature.store.getState().data?.profile.mode).toBe('teacher');
  });

  it('tells a guest that only an account decides a setting', async () => {
    const me = meClient({
      setLanguage: vi.fn(async () => err({ kind: 'not-account' as const })),
    });
    const feature = createMyData({ ...appState(), me, identity: identityClient() });

    expect(await feature.setLanguage('es')).toBe(false);
    expect(feature.store.getState().settingError).toEqual({ kind: 'not-account' });
  });
});

describe('createSignInMethods', () => {
  it('moves to the code step whatever the address, as the acknowledgement says nothing', async () => {
    const feature = createSignInMethods({ identity: identityClient() });

    expect(await feature.startEmail(' ana@example.com ', 'en')).toBe(true);
    expect(feature.store.getState().adding).toEqual({ step: 'code', email: 'ana@example.com' });
  });

  it('keeps the attempt live when the code is wrong and ends it when it is gone', async () => {
    const identity = identityClient({
      completeLinkEmail: vi
        .fn()
        .mockResolvedValueOnce(err(httpError(400, 'invalid_code')))
        .mockResolvedValueOnce(err(httpError(410, 'attempt_gone'))),
    });
    const feature = createSignInMethods({ identity });
    await feature.startEmail('ana@example.com', 'en');

    expect(await feature.completeEmail('000000')).toBe(false);
    expect(feature.store.getState()).toMatchObject({
      linkError: { kind: 'wrong-code' },
      adding: { step: 'code' },
    });

    await feature.completeEmail('000001');
    expect(feature.store.getState().linkError).toEqual({ kind: 'attempt-gone' });
  });

  it('says that an address already in use belongs to another account', async () => {
    const identity = identityClient({
      completeLinkEmail: vi.fn(async () => err(httpError(409, 'method_in_use'))),
    });
    const feature = createSignInMethods({ identity });
    await feature.startEmail('ana@example.com', 'en');

    await feature.completeEmail('123456');

    expect(feature.store.getState().linkError).toEqual({ kind: 'in-use' });
  });

  it('explains the guard when the last way in cannot be removed', async () => {
    const identity = identityClient({
      removeSignInMethod: vi.fn(async () => err(httpError(409, 'last_method'))),
    });
    const feature = createSignInMethods({ identity });

    expect(await feature.remove('7')).toBe(false);
    expect(feature.store.getState().removeError).toEqual({ kind: 'last-method' });
  });

  it('reads the list again once a method is removed', async () => {
    const identity = identityClient();
    const feature = createSignInMethods({ identity });

    await feature.remove('7');

    expect(identity.listSignInMethods).toHaveBeenCalledTimes(1);
  });
});

describe('createDeletion', () => {
  it('forgets the credential this browser held, because it stopped working', async () => {
    const state = appState();
    const feature = createDeletion({ app: state.app, me: meClient() });

    expect(await feature.submit()).toBe(true);

    expect(feature.store.getState().status).toBe('deleted');
    expect(state.app.store.getState().auth).toEqual({ status: 'none' });
    expect(state.stored()).toBeNull();
  });

  it('keeps the person signed in when the backend did not take it', async () => {
    const state = appState();
    const me = meClient({
      deleteIdentity: vi.fn(async () =>
        err({ kind: 'unavailable' as const, failure: httpError(503) }),
      ),
    });
    const feature = createDeletion({ app: state.app, me });

    expect(await feature.submit()).toBe(false);

    expect(feature.store.getState().status).toBe('failed');
    expect(state.app.store.getState().auth).toMatchObject({ status: 'authenticated' });
  });
});
