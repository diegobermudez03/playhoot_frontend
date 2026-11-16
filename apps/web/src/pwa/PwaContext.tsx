import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';

import {
  countVisit,
  hintIsDue,
  isAppleBrowser,
  isInstalled,
  loadVisits,
  noVisits,
  saveVisits,
  settle,
  today,
  type InstallVisits,
} from './installOffer';

// Chromium hands the page the install prompt instead of showing one of its own; this is the event
// it fires. No other browser has it.
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

export interface Pwa {
  // A new build is installed and waiting; refreshing hands the page over to it.
  readonly updateWaiting: boolean;
  // Accept the update: the waiting worker takes over and the page is reloaded.
  readonly applyUpdate: () => void;
  // Put the notice away. The waiting build still takes over on the next navigation.
  readonly dismissUpdate: () => void;
  // The browser can install Playhoot right now (Chromium), or installing is something the person
  // does from the browser's own menu (Apple), or it is not on offer at all.
  readonly install: 'prompt' | 'instructions' | 'unavailable';
  // Ask the browser to install. Nothing to call on Apple: the steps are shown instead.
  readonly promptInstall: () => void;
  // The one-time hint for a returning visitor is due (V-08).
  readonly hintDue: boolean;
  // The hint has been answered, one way or the other, and is never offered again.
  readonly settleHint: () => void;
}

// Everything the browser has told us so far. It is kept outside React because it arrives from
// events and from storage, never from a render, and because the server has none of it: the
// snapshot the server renders is always the empty one below.
interface PwaState {
  readonly visits: InstallVisits;
  readonly apple: boolean;
  readonly installed: boolean;
  readonly promptEvent: InstallPromptEvent | null;
  readonly waiting: ServiceWorker | null;
  readonly updateWaiting: boolean;
}

const emptyState: PwaState = {
  visits: noVisits,
  apple: false,
  installed: false,
  promptEvent: null,
  waiting: null,
  updateWaiting: false,
};

let state: PwaState = emptyState;
const listeners = new Set<() => void>();

function change(next: Partial<PwaState>): void {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const currentState = () => state;
const serverState = () => emptyState;

const PwaContext = createContext<Pwa | null>(null);

export function usePwa(): Pwa | null {
  return useContext(PwaContext);
}

// Installing and updating are the same on every page, public or private, so this sits above the
// routes — the home page is where a returning visitor arrives. It renders its children on the
// server exactly as it does in the browser; only what it offers is different.
export function PwaProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(subscribe, currentState, serverState);

  useEffect(readBrowser, []);
  useEffect(watchInstallability, []);
  useEffect(registerServiceWorker, []);

  const install: Pwa['install'] = snapshot.installed
    ? 'unavailable'
    : snapshot.promptEvent
      ? 'prompt'
      : snapshot.apple
        ? 'instructions'
        : 'unavailable';

  const value = useMemo<Pwa>(
    () => ({
      updateWaiting: snapshot.updateWaiting,
      applyUpdate,
      dismissUpdate,
      install,
      promptInstall,
      hintDue: install !== 'unavailable' && hintIsDue(snapshot.visits),
      settleHint,
    }),
    [snapshot.updateWaiting, snapshot.visits, install],
  );

  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>;
}

// What this browser is and what it remembers. Counting the visit here is what makes the hint a
// thing a returning visitor sees and a first-time one does not (V-08).
function readBrowser(): void {
  const counted = countVisit(loadVisits(), today());
  saveVisits(counted);
  change({
    visits: counted,
    apple: isAppleBrowser(navigator.userAgent, navigator.maxTouchPoints),
    installed: isInstalled(),
  });
}

function watchInstallability(): () => void {
  const onPrompt = (event: Event) => {
    // Keeping the event is what makes the offer ours: the browser then shows nothing by itself,
    // and the person is never interrupted (P01§5).
    event.preventDefault();
    change({ promptEvent: event as InstallPromptEvent });
  };
  const onInstalled = () => change({ installed: true, promptEvent: null });
  window.addEventListener('beforeinstallprompt', onPrompt);
  window.addEventListener('appinstalled', onInstalled);
  return () => {
    window.removeEventListener('beforeinstallprompt', onPrompt);
    window.removeEventListener('appinstalled', onInstalled);
  };
}

function promptInstall(): void {
  const event = state.promptEvent;
  if (!event) return;
  void event.prompt();
  void event.userChoice.finally(() => change({ promptEvent: null }));
}

function settleHint(): void {
  const settled = settle(state.visits);
  saveVisits(settled);
  change({ visits: settled });
}

function dismissUpdate(): void {
  change({ updateWaiting: false });
}

function applyUpdate(): void {
  const waiting = state.waiting;
  change({ updateWaiting: false });
  if (!waiting) return window.location.reload();
  // The page reloads once the new worker has taken over, so the new build is what renders.
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), {
    once: true,
  });
  waiting.postMessage(skipWaitingMessage);
}

// Must match `skipWaitingMessage` in `sw.ts`, which is built on its own and shares no module with
// the application bundle.
const skipWaitingMessage = 'playhoot-skip-waiting';

// Registers the worker and watches for a new build. In development there is no worker: it is
// written by the build (`vite-pwa.ts`), and a stale one would serve yesterday's files.
function registerServiceWorker(): () => void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return () => {};
  let cancelled = false;

  const announce = (registration: ServiceWorkerRegistration) => {
    // A worker waiting while this page is already controlled by another one is a new build. The
    // very first installation controls nothing yet, and is not an update to announce.
    if (cancelled || !registration.waiting || !navigator.serviceWorker.controller) return;
    change({ waiting: registration.waiting, updateWaiting: true });
  };

  void navigator.serviceWorker
    .register('/sw.js', { type: 'module', scope: '/' })
    .then((registration) => {
      if (cancelled) return;
      announce(registration);
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed') announce(registration);
        });
      });
    })
    .catch(() => {
      // No worker: the app works exactly as it did before, online only.
    });

  return () => {
    cancelled = true;
  };
}
