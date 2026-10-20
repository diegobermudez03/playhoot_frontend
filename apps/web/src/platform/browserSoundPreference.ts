const storageKey = 'playhoot.sound.v1';

// Whether the person muted the sound, remembered in this browser. Sound is on by default.
export function loadSoundMuted(): boolean {
  try {
    return window.localStorage.getItem(storageKey) === 'off';
  } catch {
    return false;
  }
}

export function saveSoundMuted(muted: boolean): void {
  try {
    window.localStorage.setItem(storageKey, muted ? 'off' : 'on');
  } catch {
    // Not persisted.
  }
}
