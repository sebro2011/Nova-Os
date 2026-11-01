import { describe, expect, it } from 'vitest';
import { defaultPreferences, sanitizePreferences } from './preferences';

describe('preference migration and validation', () => {
  it('keeps existing installations in dark mode by default', () => {
    const result = sanitizePreferences({ theme: 'cosmic', dockPinned: ['files'] });
    expect(result.colorMode).toBe('dark');
    expect(result.wallpaper).toBe('aurora');
    expect(result.customWallpaperId).toBeNull();
  });

  it('preserves light mode and a valid custom wallpaper selection', () => {
    const result = sanitizePreferences({
      ...defaultPreferences,
      colorMode: 'light',
      wallpaper: 'custom',
      customWallpaperId: 'wallpaper-local-id',
    });
    expect(result.colorMode).toBe('light');
    expect(result.wallpaper).toBe('custom');
    expect(result.customWallpaperId).toBe('wallpaper-local-id');
  });

  it('migrates and sanitizes recent apps without changing existing preferences', () => {
    expect(sanitizePreferences({ theme: 'cosmic' }).recentApps).toEqual([]);
    expect(sanitizePreferences({ recentApps: ['notes', 'notes', 'invalid', 'files'] }).recentApps).toEqual(['notes', 'files']);
  });

  it('rejects invalid wallpaper names and oversized custom IDs', () => {
    const result = sanitizePreferences({ wallpaper: 'remote-url', customWallpaperId: 'x'.repeat(141) });
    expect(result.wallpaper).toBe('aurora');
    expect(result.customWallpaperId).toBeNull();
  });

  it('migrates high contrast safely without accepting non-boolean values', () => {
    expect(sanitizePreferences({ theme: 'cosmic' }).highContrast).toBe(false);
    expect(sanitizePreferences({ highContrast: true }).highContrast).toBe(true);
    expect(sanitizePreferences({ highContrast: 'true' }).highContrast).toBe(false);
  });

  it('migrates startup and personalization options with bounded values', () => {
    const legacy = sanitizePreferences({ theme: 'cosmic' });
    expect(legacy).toMatchObject({ startupAnimation: true, startupSound: false, windowTransparent: true, glassIntensity: 'balanced', taskbarPosition: 'top', cursorStyle: 'system', removedApps: [] });

    const current = sanitizePreferences({ startupAnimation: false, startupSound: true, glassIntensity: 'rich', windowRadius: 'large', desktopLayout: 'grid', taskbarSize: 'compact', removedApps: ['notes', 'notes', 'invalid'] });
    expect(current).toMatchObject({ startupAnimation: false, startupSound: true, glassIntensity: 'rich', windowRadius: 'large', desktopLayout: 'grid', taskbarSize: 'compact', removedApps: ['notes'] });
    expect(sanitizePreferences({ windowRadius: 'unbounded', taskbarPosition: 'left' })).toMatchObject({ windowRadius: 'medium', taskbarPosition: 'top' });
  });

  it('keeps recovery and web apps available when removed-app preferences are migrated', () => {
    expect(sanitizePreferences({ removedApps: ['settings', 'app-center', 'browser', 'task-manager', 'notes'] }).removedApps).toEqual(['notes']);
  });

  it('accepts only bounded raster data for custom cursors', () => {
    expect(sanitizePreferences({ cursorStyle: 'custom', customCursor: 'data:image/png;base64,AAAA' })).toMatchObject({ cursorStyle: 'custom', customCursor: 'data:image/png;base64,AAAA' });
    expect(sanitizePreferences({ cursorStyle: 'custom', customCursor: 'data:image/svg+xml;base64,AAAA' })).toMatchObject({ cursorStyle: 'system', customCursor: null });
  });
});
