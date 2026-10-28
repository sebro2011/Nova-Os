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

  it('rejects invalid wallpaper names and oversized custom IDs', () => {
    const result = sanitizePreferences({ wallpaper: 'remote-url', customWallpaperId: 'x'.repeat(141) });
    expect(result.wallpaper).toBe('aurora');
    expect(result.customWallpaperId).toBeNull();
  });
});
