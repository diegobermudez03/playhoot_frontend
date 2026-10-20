import { createStore, type StoreApi } from 'zustand/vanilla';

import { assetPath, type AssetId } from '../assets';

export type SoundId =
  | 'tap'
  | 'key'
  | 'erase'
  | 'copy'
  | 'join'
  | 'player-joined'
  | 'player-left'
  | 'game-start'
  | 'error'
  | 'ended'
  | 'leave';

export type MusicId = 'lobby';

export interface SoundPlayer {
  // Fire and forget. Silent while muted, before the browser allows audio, or on any failure.
  play(id: SoundId): void;
  // Loops a track until stopMusic. Starting the track already playing does nothing.
  startMusic(id: MusicId): void;
  stopMusic(): void;
  setMuted(muted: boolean): void;
  store: StoreApi<{ muted: boolean }>;
}

interface SoundSpec {
  asset: AssetId;
  volume: number;
  // Stand-in tones while the real file is missing: [frequency Hz, duration s] per note.
  placeholder: [number, number][];
  wave?: OscillatorType;
}

const sounds: Record<SoundId, SoundSpec> = {
  tap: { asset: 'sound.tap', volume: 0.35, placeholder: [[660, 0.04]], wave: 'triangle' },
  key: { asset: 'sound.key', volume: 0.3, placeholder: [[880, 0.03]], wave: 'triangle' },
  erase: { asset: 'sound.erase', volume: 0.3, placeholder: [[440, 0.04]], wave: 'triangle' },
  copy: {
    asset: 'sound.copy',
    volume: 0.4,
    placeholder: [
      [784, 0.05],
      [1175, 0.08],
    ],
  },
  join: {
    asset: 'sound.join',
    volume: 0.5,
    placeholder: [
      [523, 0.07],
      [659, 0.07],
      [784, 0.12],
    ],
  },
  'player-joined': {
    asset: 'sound.player-joined',
    volume: 0.45,
    placeholder: [
      [698, 0.05],
      [1047, 0.1],
    ],
  },
  'player-left': {
    asset: 'sound.player-left',
    volume: 0.4,
    placeholder: [
      [587, 0.06],
      [440, 0.1],
    ],
  },
  'game-start': {
    asset: 'sound.game-start',
    volume: 0.6,
    placeholder: [
      [523, 0.08],
      [659, 0.08],
      [784, 0.08],
      [1047, 0.22],
    ],
    wave: 'square',
  },
  error: {
    asset: 'sound.error',
    volume: 0.45,
    placeholder: [
      [220, 0.12],
      [196, 0.18],
    ],
    wave: 'sawtooth',
  },
  ended: {
    asset: 'sound.ended',
    volume: 0.45,
    placeholder: [
      [784, 0.1],
      [659, 0.1],
      [523, 0.2],
    ],
  },
  leave: {
    asset: 'sound.leave',
    volume: 0.35,
    placeholder: [
      [523, 0.06],
      [392, 0.1],
    ],
  },
};

const music: Record<MusicId, { asset: AssetId; volume: number }> = {
  lobby: { asset: 'music.lobby', volume: 0.18 },
};

export interface SoundPlayerOptions {
  initiallyMuted: boolean;
  onMutedChange: (muted: boolean) => void;
}

// Web Audio player. The AudioContext starts on the first user gesture (browsers block audio
// before one). Files are fetched once and cached; a missing file plays its placeholder tones,
// so the experience is complete while assets are pending (docs/design/ASSETS.md).
export function createSoundPlayer(options: SoundPlayerOptions): SoundPlayer {
  const store = createStore(() => ({ muted: options.initiallyMuted }));
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  const buffers = new Map<AssetId, Promise<AudioBuffer | null>>();
  const reportedMissing = new Set<AssetId>();
  let musicId: MusicId | null = null;
  let musicSource: AudioBufferSourceNode | null = null;

  const unlock = () => {
    if (!context) {
      try {
        context = new AudioContext();
        master = context.createGain();
        master.gain.value = store.getState().muted ? 0 : 1;
        master.connect(context.destination);
      } catch {
        return;
      }
    }
    if (context.state === 'suspended') void context.resume();
    if (musicId && !musicSource) void playMusic(musicId);
  };
  if (typeof window !== 'undefined') {
    for (const event of ['pointerdown', 'keydown', 'touchstart'] as const) {
      window.addEventListener(event, unlock, { passive: true });
    }
  }

  const load = (asset: AssetId) => {
    let pending = buffers.get(asset);
    if (!pending) {
      pending = fetch(assetPath(asset))
        .then((response) => {
          if (!response.ok) throw new Error(String(response.status));
          return response.arrayBuffer();
        })
        .then((data) => context!.decodeAudioData(data))
        .catch(() => {
          if (import.meta.env.DEV && !reportedMissing.has(asset)) {
            reportedMissing.add(asset);
            console.info(`[sound] ${asset} is missing (${assetPath(asset)}); using a placeholder.`);
          }
          return null;
        });
      buffers.set(asset, pending);
    }
    return pending;
  };

  const ready = () => !!context && !!master && context.state === 'running';

  const playTones = (spec: SoundSpec) => {
    const ctx = context!;
    let at = ctx.currentTime;
    for (const [frequency, duration] of spec.placeholder) {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = spec.wave ?? 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(spec.volume * 0.5, at);
      gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
      oscillator.connect(gain).connect(master!);
      oscillator.start(at);
      oscillator.stop(at + duration + 0.02);
      at += duration * 0.9;
    }
  };

  const playMusic = async (id: MusicId) => {
    const buffer = await load(music[id].asset);
    if (!buffer || musicId !== id || musicSource || !ready()) return;
    const source = context!.createBufferSource();
    const gain = context!.createGain();
    gain.gain.value = music[id].volume;
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain).connect(master!);
    source.start();
    musicSource = source;
  };

  return {
    store,
    play(id) {
      if (store.getState().muted || !ready()) return;
      const spec = sounds[id];
      void load(spec.asset).then((buffer) => {
        if (!ready()) return;
        if (!buffer) {
          playTones(spec);
          return;
        }
        const source = context!.createBufferSource();
        const gain = context!.createGain();
        gain.gain.value = spec.volume;
        source.buffer = buffer;
        source.connect(gain).connect(master!);
        source.start();
      });
    },
    startMusic(id) {
      if (musicId === id) return;
      this.stopMusic();
      musicId = id;
      if (ready()) void playMusic(id);
    },
    stopMusic() {
      musicId = null;
      try {
        musicSource?.stop();
      } catch {
        // Already stopped.
      }
      musicSource = null;
    },
    setMuted(muted) {
      store.setState({ muted });
      options.onMutedChange(muted);
      if (master && context) master.gain.setTargetAtTime(muted ? 0 : 1, context.currentTime, 0.05);
    },
  };
}

// For places that render screens without meaning them (the /design style guide).
export const silentSoundPlayer: SoundPlayer = {
  play: () => undefined,
  startMusic: () => undefined,
  stopMusic: () => undefined,
  setMuted: () => undefined,
  store: createStore(() => ({ muted: true })),
};
