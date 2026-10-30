// Imported first by main.tsx, so it runs before any other module is evaluated (the router reads
// the location when its module loads): a sign-in's one-time code leaves the URL before anything
// else sees it.
import { captureSignInCompletion } from './platform/signInCompletion';

captureSignInCompletion();
