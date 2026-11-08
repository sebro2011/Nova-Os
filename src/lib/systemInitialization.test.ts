import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getInitializationState,
  initializeSystem,
  resetSystemInitialization,
  subscribeToInitialization,
  type InitializationState,
} from './systemInitialization';
import { BOOT_MESSAGES } from './boot';

const db = vi.hoisted(() => ({
  initializeDatabase: vi.fn(async () => undefined),
  getAllRecords: vi.fn(async () => []),
}));

vi.mock('./db', () => db);

const wallpaper = vi.hoisted(() => ({ preloadWallpaperAsset: vi.fn(async () => undefined) }));
vi.mock('./wallpaperAsset', () => wallpaper);

const originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts');

beforeEach(() => {
  vi.clearAllMocks();
  resetSystemInitialization();
  db.initializeDatabase.mockResolvedValue(undefined);
  db.getAllRecords.mockResolvedValue([]);
  wallpaper.preloadWallpaperAsset.mockResolvedValue(undefined);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0));
  Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve() } });
});

afterEach(() => {
  resetSystemInitialization();
  vi.unstubAllGlobals();
  if (originalFonts) Object.defineProperty(document, 'fonts', originalFonts);
  else Reflect.deleteProperty(document, 'fonts');
});

describe('real system initialization', () => {
  it('advances through every boot stage and runs the real init work exactly once', async () => {
    const states: InitializationState[] = [];
    const unsubscribe = subscribeToInitialization((state) => states.push(state));

    const result = await initializeSystem({ wallpaperId: null, timeoutMs: 500 });
    expect(result.status).toBe('ready');
    expect(result.progress).toBe(1);
    expect(result.stageIndex).toBe(BOOT_MESSAGES.length - 1);
    expect(result.timedOut).toBe(false);
    expect(result.errors).toEqual([]);
    expect(db.initializeDatabase).toHaveBeenCalledTimes(1);
    expect(db.getAllRecords).toHaveBeenCalledWith('websites');
    expect(wallpaper.preloadWallpaperAsset).toHaveBeenCalledWith(null);
    expect(new Set(states.map((state) => state.stageIndex))).toEqual(new Set([0, 1, 2, 3]));
    expect(getInitializationState()).toBe(result);

    // StrictMode / HMR remounts reuse the same pass instead of re-seeding storage.
    await initializeSystem({ wallpaperId: null, timeoutMs: 500 });
    expect(db.initializeDatabase).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('degrades gracefully when an initialization component fails', async () => {
    db.initializeDatabase.mockRejectedValueOnce(new Error('IndexedDB blocked'));
    const result = await initializeSystem({ wallpaperId: null, timeoutMs: 500 });

    expect(result.status).toBe('degraded');
    expect(result.errors).toContain('IndexedDB blocked');
    expect(result.timedOut).toBe(false);
    expect(result.progress).toBe(1);
    expect(result.stageIndex).toBe(3);
  });

  it('never blocks the desktop when initialization hangs', async () => {
    db.initializeDatabase.mockImplementationOnce(() => new Promise<undefined>(() => undefined));
    const result = await initializeSystem({ wallpaperId: null, timeoutMs: 25 });

    expect(result.timedOut).toBe(true);
    expect(result.status).toBe('degraded');
    expect(result.stageIndex).toBe(3);
    expect(result.progress).toBe(1);
  });

  it('reports a pending state to new subscribers', () => {
    const seen: InitializationState[] = [];
    const unsubscribe = subscribeToInitialization((state) => seen.push(state));
    expect(seen[0].status).toBe('initializing');
    expect(seen[0].progress).toBeLessThan(1);
    unsubscribe();
  });
});
