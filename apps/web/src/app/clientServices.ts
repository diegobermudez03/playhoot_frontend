import { createServices, type Services } from './services';

let instance: Services | null = null;

// The app's services exist only in the browser: they read storage, the device and the credential.
// The server renders public pages without them, so nothing here may be called while rendering on
// the server.
export function clientServices(): Services {
  instance ??= createServices();
  return instance;
}
