/** Shared constants and browser-session helpers for the NOVA boot experience. */

export const BOOT_SESSION_KEY = 'nova.boot.session.v1';
export const BOOT_PREVIEW_EVENT = 'nova:preview-boot';

/** Hard ceiling for the boot screen's wait on real initialization work (ms). */
export const BOOT_WATCHDOG_MS = 3_500;
/** Upper bound for the desktop reveal animation state (ms). */
export const DESKTOP_REVEAL_MS = 1_600;
/** Safety net when a browser never fires a Framer Motion animation-complete callback. */
export const BOOT_ANIMATION_FALLBACK_MS = 1_400;

export const BOOT_MESSAGES = [
  'Initializing NOVA OS',
  'Loading System Components',
  'Preparing Desktop Environment',
  'System Ready',
] as const;

/**
 * A tab session that has already reached the desktop skips the cinematic boot on
 * reloads, HMR remounts and bfcache restores. A new tab is a cold start and boots.
 */
export function hasEnteredDesktopThisSession(): boolean {
  try {
    return sessionStorage.getItem(BOOT_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function markDesktopEntered(): void {
  try {
    sessionStorage.setItem(BOOT_SESSION_KEY, '1');
  } catch {
    // Session storage may be blocked; the desktop still works for this page load.
  }
}

/** Clears the session marker so "Show welcome next launch" survives a reload in the same tab. */
export function resetBootSession(): void {
  try {
    sessionStorage.removeItem(BOOT_SESSION_KEY);
  } catch {
    // Session storage may be blocked.
  }
}

/** Explicit, user-initiated preview. It never starts initialization or changes app state. */
export function requestBootPreview(): void {
  window.dispatchEvent(new Event(BOOT_PREVIEW_EVENT));
}
