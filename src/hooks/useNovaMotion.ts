import { useReducedMotion } from 'framer-motion';
import { usePreferences } from '../context/PreferencesContext';

/**
 * One source of truth for motion decisions: the OS preference wins, then NOVA's
 * reduced-motion setting, then the individual animation switches.
 */
export function useNovaMotion() {
  const systemReducedMotion = useReducedMotion();
  const { preferences } = usePreferences();
  const reducedMotion = Boolean(systemReducedMotion) || preferences.reduceMotion;
  return {
    preferences,
    reducedMotion,
    neonGlow: preferences.neonGlow !== false,
    bootAnimation: preferences.startupAnimation && !reducedMotion,
    desktopAnimation: preferences.desktopAnimation !== false && !reducedMotion,
    /** Decorative effects are also suppressed in performance mode. */
    effects: !reducedMotion && !preferences.performanceMode,
  };
}
