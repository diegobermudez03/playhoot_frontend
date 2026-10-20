import { createContext, useContext, type ReactNode } from 'react';

import { silentSoundPlayer, type SoundPlayer } from './soundPlayer';

const SoundContext = createContext<SoundPlayer>(silentSoundPlayer);

export function SoundProvider({ player, children }: { player: SoundPlayer; children: ReactNode }) {
  return <SoundContext.Provider value={player}>{children}</SoundContext.Provider>;
}

export function useSound(): SoundPlayer {
  return useContext(SoundContext);
}
