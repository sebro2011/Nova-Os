import type { AppId, NovaPreferences } from '../types';

export const PREFERENCES_KEY = 'nova.preferences.v1';
export const WELCOME_KEY = 'nova.welcomed.v1';

const appIds: AppId[] = [
  'files', 'browser', 'terminal', 'settings', 'notes', 'calculator',
  'calendar', 'media', 'app-center', 'help',
];

export const defaultPreferences: NovaPreferences = {
  colorMode: 'dark',
  theme: 'cosmic',
  accent: 'blue',
  wallpaper: 'aurora',
  customWallpaperId: null,
  reduceMotion: false,
  performanceMode: false,
  compactMode: false,
  clock24h: false,
  dockPinned: ['files', 'browser', 'notes', 'terminal', 'settings'],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function sanitizePreferences(value: unknown): NovaPreferences {
  if (!isRecord(value)) return { ...defaultPreferences, dockPinned: [...defaultPreferences.dockPinned] };
  const dockPinned = Array.isArray(value.dockPinned)
    ? value.dockPinned.filter((id): id is AppId => typeof id === 'string' && appIds.includes(id as AppId)).slice(0, 10)
    : defaultPreferences.dockPinned;

  return {
    colorMode: value.colorMode === 'light' ? 'light' : defaultPreferences.colorMode,
    theme: ['cosmic', 'midnight', 'nebula'].includes(String(value.theme))
      ? value.theme as NovaPreferences['theme']
      : defaultPreferences.theme,
    accent: ['blue', 'violet', 'cyan'].includes(String(value.accent))
      ? value.accent as NovaPreferences['accent']
      : defaultPreferences.accent,
    wallpaper: ['aurora', 'orbit', 'starlight', 'custom'].includes(String(value.wallpaper))
      ? value.wallpaper as NovaPreferences['wallpaper']
      : defaultPreferences.wallpaper,
    customWallpaperId: typeof value.customWallpaperId === 'string' && value.customWallpaperId.length <= 140
      ? value.customWallpaperId
      : null,
    reduceMotion: typeof value.reduceMotion === 'boolean' ? value.reduceMotion : defaultPreferences.reduceMotion,
    performanceMode: typeof value.performanceMode === 'boolean' ? value.performanceMode : defaultPreferences.performanceMode,
    compactMode: typeof value.compactMode === 'boolean' ? value.compactMode : defaultPreferences.compactMode,
    clock24h: typeof value.clock24h === 'boolean' ? value.clock24h : defaultPreferences.clock24h,
    dockPinned: [...new Set(dockPinned)],
  };
}

export function loadPreferences(): NovaPreferences {
  try {
    const stored = localStorage.getItem(PREFERENCES_KEY);
    return stored ? sanitizePreferences(JSON.parse(stored)) : sanitizePreferences(null);
  } catch {
    return sanitizePreferences(null);
  }
}

export function savePreferences(preferences: NovaPreferences): void {
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
}
