import { createAppState, type AppState, type RefreshOutcome } from '@playhoot/app-core';
import {
  createAdminClient,
  createAdminConnector,
  createAiAccessClient,
  createGamesClient,
  createHttpClient,
  createIdentityClient,
  createNotificationsClient,
  createPreviewConnector,
  createSessionConnector,
  createSecondFactorClient,
  createSessionsClient,
  createTelemetryReporter,
  type AdminClient,
  type AdminConnector,
  type AiAccessClient,
  type GamesClient,
  type HttpClient,
  type IdentityClient,
  type NotificationsClient,
  type PreviewConnector,
  type SecondFactorClient,
  type SessionConnector,
  type SessionsClient,
} from '@playhoot/communication';
import { createDeviceCapabilitiesStore, type DeviceCapabilitiesStore } from '@playhoot/device';
import {
  createArtifactLoader,
  createAssetLoader,
  type ArtifactLoader,
  type AssetLoader,
} from '@playhoot/game-host';

import { createAdminSession, type AdminSession } from '@playhoot/feature-admin';
import { createNotifications, type Notifications } from '@playhoot/feature-notifications';
import { createAccountSignIn, type AccountSignIn } from '@playhoot/feature-sign-in';
import { refreshInvalidCode } from '@playhoot/protocol';

import { createSoundPlayer, type SoundPlayer } from '../sound';
import { createAppTelemetry, type AppTelemetry } from '../telemetry/appTelemetry';
import {
  createBrowserArtifactCache,
  createBrowserAssetCache,
} from '../platform/browserArtifactCache';
import {
  createBrowserCredentialStore,
  credentialStorageKey,
} from '../platform/browserCredentialStore';
import {
  createBrowserPendingLoginStore,
  loginChallengeOf,
  newLoginVerifier,
} from '../platform/pendingLogin';
import { loadSoundMuted, saveSoundMuted } from '../platform/browserSoundPreference';
import {
  browserLanguagePreferences,
  createBrowserLocaleStore,
} from '../platform/browserLocaleStore';
import {
  detectBrowserCapabilities,
  watchBrowserCapabilities,
} from '../platform/browserDeviceCapabilities';
import { config } from './config';

// Everything app-wide the web host runs on, created once at startup. Features receive what they
// need from here; nothing else constructs clients or reads the credential.
export interface Services {
  // Signing in with an account: one per page, since a sign-in leaves the page and comes back.
  accountSignIn: AccountSignIn;
  // The administrator's panels over `/admin/v1`, called with the admin-mode token alone (D-023).
  admin: AdminClient;
  // Admin mode itself: the 15-minute token a TOTP code buys, held in memory only.
  adminSession: AdminSession;
  // The creator's admin connections to their Sessions.
  admins: AdminConnector;
  // The account's AI apps over MCP: consenting to a connection, listing and revoking them.
  aiAccess: AiAccessClient;
  app: AppState;
  device: DeviceCapabilitiesStore;
  // Game authoring (REST): creating games and changing their drafts.
  gamesApi: GamesClient;
  // Loads GameVersion frontend artifacts, verified by hash and cached in the browser.
  gameArtifacts: ArtifactLoader;
  // Downloads game assets for the GameHost, verified by hash and cached in the browser (ADR-0008).
  gameAssets: AssetLoader;
  http: HttpClient;
  identity: IdentityClient;
  // The shell's notifications: the unread count and the panel's entries. App-global, because the
  // bar outlives every route.
  notifications: Notifications;
  notificationsApi: NotificationsClient;
  // The creator's live connections to previews of their drafts.
  previews: PreviewConnector;
  sessions: SessionConnector;
  // Session creation (REST).
  sessionsApi: SessionsClient;
  // The administrator's TOTP credential, and the codes that buy admin mode and a step-up proof.
  // Called with the account credential, like every other `/v1/identity` endpoint.
  secondFactor: SecondFactorClient;
  sound: SoundPlayer;
  // Classified telemetry, sent to the backend in batches (plan §17).
  telemetry: AppTelemetry;
}

export function createServices(): Services {
  // The identity client needs HTTP, HTTP needs the app's credentials, and the app renews them
  // through the identity client: the app reaches it through this late-bound reference.
  let identityClient: IdentityClient | null = null;
  const app = createAppState({
    credentials: createBrowserCredentialStore(),
    refresher: {
      async refresh(credential): Promise<RefreshOutcome> {
        if (!credential.refreshToken || !identityClient) return { kind: 'invalid' };
        const result = await identityClient.refresh(credential.refreshToken);
        if (result.ok) return { kind: 'renewed', credential: result.value };
        return result.error.kind === 'http' && result.error.code === refreshInvalidCode
          ? { kind: 'invalid' }
          : { kind: 'unavailable' };
      },
    },
    revoke: (refreshToken) => identityClient?.logout(refreshToken) ?? Promise.resolve(),
    locale: { store: createBrowserLocaleStore(), devicePreferences: browserLanguagePreferences },
  });
  const device = createDeviceCapabilitiesStore(detectBrowserCapabilities());
  const http = createHttpClient({
    baseUrl: config.apiBaseUrl,
    credentials: app.credentials,
    onCredentialRejected: app.signOut,
  });
  identityClient = createIdentityClient(http);
  // Admin mode is a second credential, not a stronger one: its own token, its own HTTP client,
  // and no renewal — when the backend refuses it, admin mode is simply over (D-023).
  const adminSession = createAdminSession();
  const adminHttp = createHttpClient({
    baseUrl: config.apiBaseUrl,
    credentials: adminSession.credentials,
    onCredentialRejected: adminSession.release,
  });
  const notificationsApi = createNotificationsClient(http);
  const sessions = createSessionConnector({
    realtimeBaseUrl: realtimeBaseUrl(config.apiBaseUrl),
    credentials: app.credentials,
    device: () => device.getState().deviceClass,
  });
  const sound = createSoundPlayer({
    initiallyMuted: loadSoundMuted(),
    onMutedChange: saveSoundMuted,
  });
  const gameArtifacts = createArtifactLoader({ cache: createBrowserArtifactCache() });
  const gameAssets = createAssetLoader({ cache: createBrowserAssetCache() });
  const telemetry = createAppTelemetry(
    createTelemetryReporter({
      http,
      timers: browserTimers,
      // The backend takes telemetry from any identity, guests included, but not from nobody.
      canSend: () => app.credentials.currentToken() !== null,
    }),
    import.meta.env.DEV ? (event) => console.debug('[telemetry]', event) : undefined,
  );
  return {
    accountSignIn: createAccountSignIn({
      app,
      identity: identityClient,
      pending: createBrowserPendingLoginStore(),
      newVerifier: newLoginVerifier,
      challengeOf: loginChallengeOf,
      // The backend answers a path of its own origin.
      leaveTo: (url) =>
        window.location.assign(new URL(url, config.apiBaseUrl || window.location.origin).href),
    }),
    admin: createAdminClient(adminHttp),
    adminSession,
    admins: createAdminConnector({
      realtimeBaseUrl: realtimeBaseUrl(config.apiBaseUrl),
      credentials: app.credentials,
    }),
    aiAccess: createAiAccessClient(http),
    app,
    device,
    gameArtifacts,
    gameAssets,
    gamesApi: createGamesClient(http),
    http,
    identity: identityClient,
    notifications: createNotifications({ app, client: notificationsApi }),
    notificationsApi,
    previews: createPreviewConnector({
      realtimeBaseUrl: realtimeBaseUrl(config.apiBaseUrl),
      credentials: app.credentials,
    }),
    sessions,
    sessionsApi: createSessionsClient(http),
    secondFactor: createSecondFactorClient(http),
    sound,
    telemetry,
  };
}

const browserTimers = {
  now: () => Date.now(),
  setTimeout: (run: () => void, delayMs: number): unknown => window.setTimeout(run, delayMs),
  clearTimeout: (handle: unknown) => window.clearTimeout(handle as number),
};

// WebSockets go to the same backend as HTTP: the configured origin, or this page's origin.
function realtimeBaseUrl(apiBaseUrl: string): string {
  const origin = apiBaseUrl || window.location.origin;
  return origin.replace(/^http/, 'ws');
}

// App bootstrap (plan §13.1): resolve the persisted identity and language, and start watching device
// capabilities. The router resolves the URL afterwards and features rebuild from URL + backend.
export function startServices(services: Services): () => void {
  services.app.bootstrap();
  const stopLoadingOperations = loadOperations(services);
  const stopFollowingIdentity = followIdentity(services);
  const stopWatching = watchBrowserCapabilities(services.device);
  // The last chance to send queued telemetry: the tab is hidden (often for good on phones) or the
  // page is going away. Coming back, the access token is renewed if it expired while timers slept.
  const sendBeforeLeaving = () => {
    if (document.visibilityState === 'hidden') services.telemetry.flush(true);
    else services.app.ensureFresh();
  };
  // Another tab signed in, out, or rotated the refresh token.
  const followOtherTabs = (event: StorageEvent) => {
    if (event.key === credentialStorageKey || event.key === null) services.app.syncFromStore();
  };
  window.addEventListener('storage', followOtherTabs);
  document.addEventListener('visibilitychange', sendBeforeLeaving);
  window.addEventListener('pagehide', sendBeforeLeaving);
  return () => {
    stopLoadingOperations();
    stopFollowingIdentity();
    stopWatching();
    document.removeEventListener('visibilitychange', sendBeforeLeaving);
    window.removeEventListener('storage', followOtherTabs);
    window.removeEventListener('pagehide', sendBeforeLeaving);
  };
}

// The bell belongs to whoever is signed in: their list is read when they arrive and forgotten
// when they leave, so a notification of theirs never shows to the next person on this browser.
function followIdentity(services: Services): () => void {
  let previous: string | null = null;
  const apply = (status: string) => {
    if (status === previous) return;
    previous = status;
    if (status === 'guest' || status === 'authenticated') void services.notifications.refresh();
    else if (status === 'none') services.notifications.clear();
  };
  apply(services.app.store.getState().auth.status);
  return services.app.store.subscribe((state) => apply(state.auth.status));
}

// Reads the backend's operation catalog (which level each operation requires). Routes that need it
// wait meanwhile; while the backend cannot be reached it is asked again, waiting longer each time.
function loadOperations(services: Services): () => void {
  let stopped = false;
  let retry: number | undefined;
  const attempt = async (failures: number) => {
    const result = await services.identity.listOperations();
    if (stopped) return;
    if (result.ok) {
      services.app.setOperations(result.value);
      return;
    }
    const delayMs = Math.min(operationsRetryMaxMs, 1000 * 2 ** failures);
    retry = window.setTimeout(() => void attempt(failures + 1), delayMs);
  };
  void attempt(0);
  return () => {
    stopped = true;
    window.clearTimeout(retry);
  };
}

const operationsRetryMaxMs = 30_000;
