// When Playhoot offers to be installed (V-08, P01§5).
//
// Installing is a voluntary improvement for people who come back, never a condition and never an
// interruption. Two things are offered, and they are not the same thing: the shell menu always
// carries an "Install Playhoot" entry, and a returning visitor is shown a hint once — after their
// second visit on a different day — which they can dismiss forever.

// How many distinct days of visiting before the hint is worth showing.
const visitsBeforeHint = 2;

const storageKey = 'playhoot.install.v1';

export interface InstallVisits {
  // Distinct days this browser has opened Playhoot, counted up to the threshold.
  readonly days: number;
  // The last day counted, as YYYY-MM-DD in the person's own time zone.
  readonly lastDay: string;
  // The hint has been shown or dismissed, and is not offered again.
  readonly settled: boolean;
}

export const noVisits: InstallVisits = { days: 0, lastDay: '', settled: false };

export function today(now: Date = new Date()): string {
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

// A visit on a day not yet counted moves the count on; several visits in one day count once.
export function countVisit(visits: InstallVisits, day: string): InstallVisits {
  if (visits.lastDay === day) return visits;
  return { ...visits, days: Math.min(visits.days + 1, visitsBeforeHint), lastDay: day };
}

export function hintIsDue(visits: InstallVisits): boolean {
  return !visits.settled && visits.days >= visitsBeforeHint;
}

export function settle(visits: InstallVisits): InstallVisits {
  return { ...visits, settled: true };
}

export function loadVisits(): InstallVisits {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return noVisits;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return noVisits;
    const value = parsed as Partial<InstallVisits>;
    return {
      days: typeof value.days === 'number' ? value.days : 0,
      lastDay: typeof value.lastDay === 'string' ? value.lastDay : '',
      settled: value.settled === true,
    };
  } catch {
    return noVisits;
  }
}

export function saveVisits(visits: InstallVisits): void {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(visits));
  } catch {
    // Blocked storage only means the hint may be offered again on the next visit.
  }
}

// Safari on iOS and iPadOS never fires `beforeinstallprompt`: there, installing is a thing the
// person does from the browser's own share menu, so the offer is a short instruction instead of a
// button that installs.
export function isAppleBrowser(userAgent: string, maxTouchPoints: number): boolean {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return true;
  // iPadOS asks for desktop sites by default and calls itself a Mac; a Mac has no touch screen.
  return /Macintosh/i.test(userAgent) && maxTouchPoints > 1;
}

// Already installed: the page is running in its own window, or iOS says it was added to the home
// screen. Nothing is offered then.
export function isInstalled(): boolean {
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
    if (window.matchMedia('(display-mode: window-controls-overlay)').matches) return true;
  } catch {
    // An old browser without `matchMedia` support for these: fall through.
  }
  return (window.navigator as { standalone?: boolean }).standalone === true;
}
