import { createAppState, type AppState } from '@playhoot/app-core';
import {
  createHttpClient,
  createIdentityClient,
  type HttpClient,
  type IdentityClient,
} from '@playhoot/communication';
import { createDeviceCapabilitiesStore, type DeviceCapabilitiesStore } from '@playhoot/device';

import { createBrowserCredentialStore } from '../platform/browserCredentialStore';
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
}

export function createServices(): Services {
  const app = createAppState(createBrowserCredentialStore());
  const device = createDeviceCapabilitiesStore(detectBrowserCapabilities());
  const http = createHttpClient({
    baseUrl: config.apiBaseUrl,
    credentials: app.credentials,
    onCredentialRejected: app.signOut,
  });
  return { app, device, http, identity: createIdentityClient(http) };
}

// App bootstrap (plan §13.1): resolve the persisted identity and start watching device
// capabilities. The router resolves the URL afterwards and features rebuild from URL + backend.
export function startServices(services: Services): () => void {
  services.app.bootstrap();
  return watchBrowserCapabilities(services.device);
}
