import { createContext, useContext, type ReactNode } from 'react';
import type { AppId } from '../types';

export interface LaunchContextValue {
  openApp: (appId: AppId) => void;
  closeActiveWindow: () => void;
}

const LaunchContext = createContext<LaunchContextValue | null>(null);

export function LaunchProvider({ children, value }: { children: ReactNode; value: LaunchContextValue }) {
  return <LaunchContext.Provider value={value}>{children}</LaunchContext.Provider>;
}

export function useLauncher(): LaunchContextValue {
  const context = useContext(LaunchContext);
  if (!context) throw new Error('useLauncher must be used within LaunchProvider.');
  return context;
}
