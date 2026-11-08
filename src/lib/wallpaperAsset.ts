import { getRecord, initializeDatabase } from './db';
import type { WallpaperRecord } from '../types';

/**
 * One custom wallpaper object URL per record, shared by the boot initializer and the
 * desktop shell. Keeping a tiny bounded cache prevents duplicate IndexedDB reads,
 * duplicate blob URLs and the flicker caused by revoking a URL that is still painted.
 */
const MAX_CACHED_URLS = 2;
const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

export function getCachedWallpaperUrl(id: string): string | undefined {
  return cache.get(id);
}

export function loadWallpaperAsset(id: string): Promise<string> {
  const cached = cache.get(id);
  if (cached) return Promise.resolve(cached);
  const pending = inflight.get(id);
  if (pending) return pending;

  const promise = (async () => {
    await initializeDatabase();
    const record = await getRecord<WallpaperRecord>('wallpapers', id);
    if (!record?.blob) {
      throw new Error('The selected custom wallpaper is no longer available. Choose another wallpaper in Settings.');
    }
    if (typeof URL.createObjectURL !== 'function') {
      throw new Error('This browser cannot display the selected custom wallpaper.');
    }
    const url = URL.createObjectURL(record.blob);
    cache.set(id, url);
    for (const key of [...cache.keys()]) {
      if (cache.size <= MAX_CACHED_URLS) break;
      if (key === id) continue;
      const previous = cache.get(key);
      if (previous && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(previous);
      cache.delete(key);
    }
    return url;
  })();

  inflight.set(id, promise);
  void promise.then(() => inflight.delete(id), () => inflight.delete(id));
  return promise;
}

/** Resolves and decodes a custom wallpaper so the desktop fade-in never paints an empty frame. */
export async function preloadWallpaperAsset(id: string | null): Promise<void> {
  if (!id) return;
  const url = await loadWallpaperAsset(id);
  if (typeof Image !== 'function') return;
  const image = new Image();
  image.src = url;
  if (typeof image.decode === 'function') await image.decode();
}

/** Test/page-unload helper; browsers release object URLs automatically on unload. */
export function releaseWallpaperAssets(): void {
  if (typeof URL.revokeObjectURL === 'function') {
    cache.forEach((url) => URL.revokeObjectURL(url));
  }
  cache.clear();
  inflight.clear();
}
