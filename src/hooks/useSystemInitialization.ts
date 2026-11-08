import { useEffect, useSyncExternalStore } from 'react';
import {
  getInitializationState,
  initializeSystem,
  subscribeToInitialization,
  type InitializationState,
} from '../lib/systemInitialization';

/**
 * Binds the desktop shell to the one real system initialization pass. The work starts
 * as soon as the shell mounts (even while the boot screen is visible) and is shared
 * across StrictMode remounts. Nothing here waits on an artificial timer.
 */
export function useSystemInitialization(plan: { wallpaperId: string | null }): InitializationState {
  const state = useSyncExternalStore(subscribeToInitialization, getInitializationState, getInitializationState);
  useEffect(() => {
    void initializeSystem({ wallpaperId: plan.wallpaperId });
  }, [plan.wallpaperId]);
  return state;
}
