import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

// How the shell frames the page under it. The frame itself is rendered once, above the router, so
// it survives every navigation (P14§1: the bar is always there); a screen only says how it wants
// to be framed.
export type ShellMode =
  // The whole bar.
  | 'normal'
  // The bar without the logo: the page shows its own big one.
  | 'bare'
  // No bar and a thin margin: the page takes the display (a game on a landscape screen) and
  // offers from inside whatever it needs from the bar.
  | 'immersive'
  // No bar and no margin of ours: the page brings its own frame. The admin area does (D-023).
  | 'plain';

interface Shell {
  mode: ShellMode;
  setMode: (mode: ShellMode) => void;
}

const ShellContext = createContext<Shell>({ mode: 'normal', setMode: () => undefined });

export function ShellProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ShellMode>('normal');
  return <ShellContext.Provider value={{ mode, setMode }}>{children}</ShellContext.Provider>;
}

export function useShell(): Shell {
  return useContext(ShellContext);
}

// A screen asks to be framed this way while it is open. Leaving it puts the bar back, so no
// screen can leave the next one without a bar.
export function useShellMode(mode: ShellMode): void {
  const { setMode } = useShell();
  useEffect(() => {
    setMode(mode);
    return () => setMode('normal');
  }, [mode, setMode]);
}
