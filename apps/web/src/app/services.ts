import { createAppState, type AppState } from '@playhoot/app-core';
import {
  createHttpClient,
  createIdentityClient,
  createSessionConnector,
  createTelemetryReporter,
  type HttpClient,
  type IdentityClient,
  type SessionConnector,
} from '@playhoot/communication';
import { createDeviceCapabilitiesStore, type DeviceCapabilitiesStore } from '@playhoot/device';
import {
  createArtifactLoader,
  createAssetLoader,
  type ArtifactLoader,
  type AssetLoader,
} from '@playhoot/game-host';

import { createSoundPlayer, type SoundPlayer } from '../sound';
import { createAppTelemetry, type AppTelemetry } from '../telemetry/appTelemetry';
import {
  createBrowserArtifactCache,
  createBrowserAssetCache,
} from '../platform/browserArtifactCache';
import { createBrowserCredentialStore } from '../platform/browserCredentialStore';
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
  app: AppState;
  device: DeviceCapabilitiesStore;
  // Loads GameVersion frontend artifacts, verified by hash and cached in the browser.
  gameArtifacts: ArtifactLoader;
  // Downloads game assets for the GameHost, verified by hash and cached in the browser (ADR-0008).
  gameAssets: AssetLoader;
  http: HttpClient;
  identity: IdentityClient;
  sessions: SessionConnector;
  sound: SoundPlayer;
  // Classified telemetry, sent to the backend in batches (plan §17).
  telemetry: AppTelemetry;
}

export function createServices(): Services {
  const app = createAppState({
    credentials: createBrowserCredentialStore(),
    locale: { store: createBrowserLocaleStore(), devicePreferences: browserLanguagePreferences },
  });
  const device = createDeviceCapabilitiesStore(detectBrowserCapabilities());
  const http = createHttpClient({
    baseUrl: config.apiBaseUrl,
    credentials: app.credentials,
    onCredentialRejected: app.signOut,
  });
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
    app,
    device,
    gameArtifacts,
    gameAssets,
    http,
    identity: createIdentityClient(http),
    sessions,
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
  const stopWatching = watchBrowserCapabilities(services.device);
  // The last chance to send queued telemetry: the tab is hidden (often for good on phones) or the
  // page is going away.
  const sendBeforeLeaving = () => {
    if (document.visibilityState === 'hidden') services.telemetry.flush(true);
  };
  document.addEventListener('visibilitychange', sendBeforeLeaving);
  window.addEventListener('pagehide', sendBeforeLeaving);
  return () => {
    stopWatching();
    document.removeEventListener('visibilitychange', sendBeforeLeaving);
    window.removeEventListener('pagehide', sendBeforeLeaving);
  };
}
