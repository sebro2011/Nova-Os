import type { AppId, NovaPreferences } from '../types';
import { sanitizeRasterDataUrl } from './image';

export const PREFERENCES_KEY = 'nova.preferences.v1';
export const WELCOME_KEY = 'nova.welcomed.v1';

const appIds: AppId[] = [
  'files', 'browser', 'terminal', 'settings', 'notes', 'calculator',
  'calendar', 'media', 'app-center', 'task-manager', 'help', 'office', 'writer', 'sheets', 'slides', 'pdf',
];

const protectedAppIds = new Set<AppId>(['settings', 'app-center', 'browser', 'task-manager']);

export const defaultPreferences: NovaPreferences = {
  colorMode: 'dark',
  theme: 'cosmic',
  accent: 'blue',
  language: 'en',
  wallpaper: 'aurora',
  customWallpaperId: null,
  startupAnimation: true,
  startupSound: false,
  windowTransparent: true,
  windowRadius: 'medium',
  glassIntensity: 'balanced',
  blurEnabled: true,
  showDesktopLabels: true,
  desktopIconSize: 'medium',
  desktopLayout: 'vertical',
  showClock: true,
  taskbarSize: 'auto',
  taskbarTransparent: true,
  taskbarPosition: 'top',
  cursorStyle: 'system',
  customCursor: null,
  reduceMotion: false,
  performanceMode: false,
  highContrast: false,
  compactMode: false,
  clock24h: false,
  dockPinned: ['files', 'browser', 'notes', 'terminal', 'settings'],
  recentApps: [],
  recentOfficeFiles: [],
  removedApps: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && allowed.includes(value as T) ? value as T : fallback;
}

export function sanitizePreferences(value: unknown): NovaPreferences {
  if (!isRecord(value)) return { ...defaultPreferences, dockPinned: [...defaultPreferences.dockPinned], recentApps: [], recentOfficeFiles: [], removedApps: [] };
  const dockPinned = Array.isArray(value.dockPinned)
    ? value.dockPinned.filter((id): id is AppId => typeof id === 'string' && appIds.includes(id as AppId)).slice(0, 10)
    : defaultPreferences.dockPinned;
  const recentApps = Array.isArray(value.recentApps)
    ? value.recentApps.filter((id): id is AppId => typeof id === 'string' && appIds.includes(id as AppId)).slice(0, 5)
    : [];
  const removedApps = Array.isArray(value.removedApps)
    ? value.removedApps.filter((id): id is AppId => typeof id === 'string' && appIds.includes(id as AppId) && !protectedAppIds.has(id as AppId))
    : [];
  const recentOfficeFiles = Array.isArray(value.recentOfficeFiles)
    ? value.recentOfficeFiles.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 140).slice(0, 50)
    : [];
  const customCursor = sanitizeRasterDataUrl(value.customCursor);

  return {
    colorMode: value.colorMode === 'light' ? 'light' : defaultPreferences.colorMode,
    theme: ['cosmic', 'midnight', 'nebula'].includes(String(value.theme))
      ? value.theme as NovaPreferences['theme']
      : defaultPreferences.theme,
    accent: ['blue', 'violet', 'cyan'].includes(String(value.accent))
      ? value.accent as NovaPreferences['accent']
      : defaultPreferences.accent,
    language: enumValue(value.language, ['en', 'si', 'ta'] as const, defaultPreferences.language),
    wallpaper: ['aurora', 'orbit', 'starlight', 'custom'].includes(String(value.wallpaper))
      ? value.wallpaper as NovaPreferences['wallpaper']
      : defaultPreferences.wallpaper,
    customWallpaperId: typeof value.customWallpaperId === 'string' && value.customWallpaperId.length <= 140
      ? value.customWallpaperId
      : null,
    startupAnimation: typeof value.startupAnimation === 'boolean' ? value.startupAnimation : defaultPreferences.startupAnimation,
    startupSound: typeof value.startupSound === 'boolean' ? value.startupSound : defaultPreferences.startupSound,
    windowTransparent: typeof value.windowTransparent === 'boolean' ? value.windowTransparent : defaultPreferences.windowTransparent,
    windowRadius: enumValue(value.windowRadius, ['small', 'medium', 'large'] as const, defaultPreferences.windowRadius),
    glassIntensity: enumValue(value.glassIntensity, ['subtle', 'balanced', 'rich'] as const, defaultPreferences.glassIntensity),
    blurEnabled: typeof value.blurEnabled === 'boolean' ? value.blurEnabled : defaultPreferences.blurEnabled,
    showDesktopLabels: typeof value.showDesktopLabels === 'boolean' ? value.showDesktopLabels : defaultPreferences.showDesktopLabels,
    desktopIconSize: enumValue(value.desktopIconSize, ['small', 'medium', 'large'] as const, defaultPreferences.desktopIconSize),
    desktopLayout: enumValue(value.desktopLayout, ['vertical', 'grid'] as const, defaultPreferences.desktopLayout),
    showClock: typeof value.showClock === 'boolean' ? value.showClock : defaultPreferences.showClock,
    taskbarSize: enumValue(value.taskbarSize, ['auto', 'compact', 'large'] as const, defaultPreferences.taskbarSize),
    taskbarTransparent: typeof value.taskbarTransparent === 'boolean' ? value.taskbarTransparent : defaultPreferences.taskbarTransparent,
    taskbarPosition: enumValue(value.taskbarPosition, ['top', 'bottom'] as const, defaultPreferences.taskbarPosition),
    cursorStyle: value.cursorStyle === 'custom' && !customCursor ? 'system' : enumValue(value.cursorStyle, ['system', 'nova', 'custom'] as const, defaultPreferences.cursorStyle),
    customCursor,
    reduceMotion: typeof value.reduceMotion === 'boolean' ? value.reduceMotion : defaultPreferences.reduceMotion,
    performanceMode: typeof value.performanceMode === 'boolean' ? value.performanceMode : defaultPreferences.performanceMode,
    highContrast: typeof value.highContrast === 'boolean' ? value.highContrast : defaultPreferences.highContrast,
    compactMode: typeof value.compactMode === 'boolean' ? value.compactMode : defaultPreferences.compactMode,
    clock24h: typeof value.clock24h === 'boolean' ? value.clock24h : defaultPreferences.clock24h,
    dockPinned: [...new Set(dockPinned)],
    recentApps: [...new Set(recentApps)],
    recentOfficeFiles: [...new Set(recentOfficeFiles)],
    removedApps: [...new Set(removedApps)],
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
