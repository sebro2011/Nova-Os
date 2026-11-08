import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getCachedWallpaperUrl,
  loadWallpaperAsset,
  preloadWallpaperAsset,
  releaseWallpaperAssets,
} from './wallpaperAsset';

const db = vi.hoisted(() => ({
  initializeDatabase: vi.fn(async () => undefined),
  getRecord: vi.fn(async () => ({ blob: new Blob(['wallpaper']) })),
}));

vi.mock('./db', () => db);

let nextUrl = 0;

beforeEach(() => {
  vi.clearAllMocks();
  releaseWallpaperAssets();
  nextUrl = 0;
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => `blob:nova-wallpaper-${++nextUrl}`),
  });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  db.getRecord.mockResolvedValue({ blob: new Blob(['wallpaper']) } as never);
});

afterEach(() => {
  releaseWallpaperAssets();
});

describe('shared custom wallpaper asset', () => {
  it('loads one blob URL per record and shares it between boot and desktop', async () => {
    const [first, second] = await Promise.all([loadWallpaperAsset('wallpaper-1'), loadWallpaperAsset('wallpaper-1')]);
    expect(first).toBe(second);
    expect(first).toBe('blob:nova-wallpaper-1');
    expect(db.getRecord).toHaveBeenCalledTimes(1);
    expect(getCachedWallpaperUrl('wallpaper-1')).toBe(first);
    expect(await loadWallpaperAsset('wallpaper-1')).toBe(first);
    expect(db.getRecord).toHaveBeenCalledTimes(1);
  });

  it('keeps the cache bounded and revokes superseded URLs', async () => {
    await loadWallpaperAsset('wallpaper-1');
    await loadWallpaperAsset('wallpaper-2');
    await loadWallpaperAsset('wallpaper-3');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:nova-wallpaper-1');
    expect(getCachedWallpaperUrl('wallpaper-1')).toBeUndefined();
    expect(getCachedWallpaperUrl('wallpaper-3')).toBe('blob:nova-wallpaper-3');
  });

  it('fails safely and retries after a missing record', async () => {
    db.getRecord.mockResolvedValueOnce(undefined as never);
    await expect(loadWallpaperAsset('missing')).rejects.toThrow(/no longer available/);
    await expect(loadWallpaperAsset('missing')).resolves.toBe('blob:nova-wallpaper-1');
  });

  it('skips database work when no custom wallpaper is selected', async () => {
    await expect(preloadWallpaperAsset(null)).resolves.toBeUndefined();
    expect(db.initializeDatabase).not.toHaveBeenCalled();
  });
});
