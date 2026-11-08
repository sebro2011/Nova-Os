import { BOOT_MESSAGES, BOOT_WATCHDOG_MS } from './boot';
import { getAllRecords, initializeDatabase } from './db';
import { loadPreferences } from './preferences';
import { errorMessage } from './utils';
import { preloadWallpaperAsset } from './wallpaperAsset';
import { primeWebsiteShortcuts } from './websiteShortcutCache';
import type { WebsiteShortcut } from '../types';

export type InitializationStatus = 'initializing' | 'ready' | 'degraded';

/** Immutable snapshot consumed by the boot screen through useSyncExternalStore. */
export interface InitializationState {
  status: InitializationStatus;
  /** 0..3, matching BOOT_MESSAGES. */
  stageIndex: number;
  /** 0..1, derived from completed work rather than a fake timer. */
  progress: number;
  errors: string[];
  timedOut: boolean;
}

export interface SystemInitializationPlan {
  wallpaperId?: string | null;
  /** Overridable for tests; production uses BOOT_WATCHDOG_MS. */
  timeoutMs?: number;
}

const STAGE_PROGRESS = 0.28;
const INITIAL_PROGRESS = 0.06;

function emptyState(): InitializationState {
  return { status: 'initializing', stageIndex: 0, progress: INITIAL_PROGRESS, errors: [], timedOut: false };
}

let state: InitializationState = emptyState();
let pending: Promise<InitializationState> | undefined;
const listeners = new Set<(next: InitializationState) => void>();

function publish(patch: Partial<InitializationState>): InitializationState {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener(state));
  return state;
}

export function subscribeToInitialization(listener: (next: InitializationState) => void): () => void {
  listeners.add(listener);
  // Late subscribers (e.g. a remounted shell) immediately see the current snapshot.
  listener(state);
  return () => { listeners.delete(listener); };
}

export function getInitializationState(): InitializationState {
  return state;
}

/** A single frame is enough to know the browser has painted the boot screen. */
function firstPaint(): Promise<void> {
  if (typeof requestAnimationFrame !== 'function') return Promise.resolve();
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

async function fontsReady(): Promise<void> {
  const fonts = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts;
  if (fonts?.ready) await fonts.ready;
}

interface InitializationTask {
  run: (plan: SystemInitializationPlan) => Promise<void>;
}

/** Real work, in dependency order. There are no sleeps or staged timeouts here. */
const TASKS: readonly InitializationTask[] = [
  {
    run: async () => {
      // Preferences are hydrated synchronously by PreferencesProvider; re-validating the
      // stored record confirms LocalStorage is readable before the desktop is unlocked.
      loadPreferences();
      await firstPaint();
    },
  },
  {
    run: async () => {
      await initializeDatabase();
      const records = await getAllRecords<WebsiteShortcut>('websites');
      primeWebsiteShortcuts(records);
    },
  },
  {
    run: async (plan) => {
      await preloadWallpaperAsset(plan.wallpaperId ?? null);
      await fontsReady();
    },
  },
];

function runInitialization(plan: SystemInitializationPlan): Promise<InitializationState> {
  return new Promise<InitializationState>((resolve) => {
    const errors: string[] = [];
    let settled = false;
    const timer = setTimeout(
      () => finish({ status: 'degraded', timedOut: true, errors: [...errors] }),
      plan.timeoutMs ?? BOOT_WATCHDOG_MS,
    );

    function finish(patch: Partial<InitializationState>): void {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(publish({ ...patch, stageIndex: BOOT_MESSAGES.length - 1, progress: 1 }));
    }

    void (async () => {
      for (let index = 0; index < TASKS.length; index += 1) {
        publish({ stageIndex: index, progress: INITIAL_PROGRESS + index * STAGE_PROGRESS, errors: [...errors] });
        try {
          await TASKS[index].run(plan);
        } catch (caught) {
          // A failing component degrades the boot, it never blocks the desktop.
          errors.push(errorMessage(caught));
        }
        if (settled) return;
        publish({
          stageIndex: index + 1,
          progress: INITIAL_PROGRESS + (index + 1) * STAGE_PROGRESS,
          errors: [...errors],
        });
      }
      finish({ status: errors.length ? 'degraded' : 'ready', timedOut: false, errors: [...errors] });
    })();
  });
}

/**
 * Idempotent per page load. React StrictMode, HMR and repeated mounts all share the
 * same initialization pass, so IndexedDB seeding and asset loads happen only once.
 */
export function initializeSystem(plan: SystemInitializationPlan = {}): Promise<InitializationState> {
  if (!pending) pending = runInitialization(plan);
  return pending;
}

/** Test-only reset for a fresh page-load scenario. */
export function resetSystemInitialization(): void {
  pending = undefined;
  state = emptyState();
  listeners.clear();
}
