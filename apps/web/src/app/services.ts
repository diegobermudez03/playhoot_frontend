import { createAppState, type AppState } from '@playhoot/app-core';
import {
  createHttpClient,
  createIdentityClient,
  createSessionConnector,
  type HttpClient,
  type IdentityClient,
  type SessionConnector,
} from '@playhoot/communication';
import { createDeviceCapabilitiesStore, type DeviceCapabilitiesStore } from '@playhoot/device';

import { createSoundPlayer, type SoundPlayer } from '../sound';
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
  http: HttpClient;
  identity: IdentityClient;
  sessions: SessionConnector;
  sound: SoundPlayer;
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
  });
  const sound = createSoundPlayer({
    initiallyMuted: loadSoundMuted(),
    onMutedChange: saveSoundMuted,
  });
  return { app, device, http, identity: createIdentityClient(http), sessions, sound };
}

// WebSockets go to the same backend as HTTP: the configured origin, or this page's origin.
function realtimeBaseUrl(apiBaseUrl: string): string {
  const origin = apiBaseUrl || window.location.origin;
  return origin.replace(/^http/, 'ws');
}

// App bootstrap (plan §13.1): resolve the persisted identity and language, and start watching device
// capabilities. The router resolves the URL afterwards and features rebuild from URL + backend.
export function startServices(services: Services): () => void {
  services.app.bootstrap();
  return watchBrowserCapabilities(services.device);
}
