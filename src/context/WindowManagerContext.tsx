import { createContext, useContext, type ReactNode } from 'react';
import type { NovaWindow } from '../types';

export interface WindowManagerContextValue {
  windows: NovaWindow[];
  focusWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  closeWindow: (id: string) => void;
}

const WindowManagerContext = createContext<WindowManagerContextValue | null>(null);

/** Kept separate from LaunchContext so window movement does not rerender unrelated apps. */
export function WindowManagerProvider({ children, value }: { children: ReactNode; value: WindowManagerContextValue }) {
  return <WindowManagerContext.Provider value={value}>{children}</WindowManagerContext.Provider>;
}

export function useWindowControls(): WindowManagerContextValue {
  const context = useContext(WindowManagerContext);
  if (!context) throw new Error('useWindowControls must be used within WindowManagerProvider.');
  return context;
}
