import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BOOT_MESSAGES,
  BOOT_PREVIEW_EVENT,
  hasEnteredDesktopThisSession,
  markDesktopEntered,
  requestBootPreview,
  resetBootSession,
} from './boot';

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('boot session and preview helpers', () => {
  it('exposes the four required boot messages in order', () => {
    expect(BOOT_MESSAGES).toEqual([
      'Initializing NOVA OS',
      'Loading System Components',
      'Preparing Desktop Environment',
      'System Ready',
    ]);
  });

  it('marks a session as booted so reloads do not cover the desktop', () => {
    expect(hasEnteredDesktopThisSession()).toBe(false);
    markDesktopEntered();
    expect(hasEnteredDesktopThisSession()).toBe(true);
    resetBootSession();
    expect(hasEnteredDesktopThisSession()).toBe(false);
  });

  it('uses an explicit local event for the Settings preview', () => {
    const listener = vi.fn();
    window.addEventListener(BOOT_PREVIEW_EVENT, listener);
    requestBootPreview();
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(BOOT_PREVIEW_EVENT, listener);
  });

  it('survives blocked session storage', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(hasEnteredDesktopThisSession()).toBe(false);
    expect(() => markDesktopEntered()).not.toThrow();
    expect(() => resetBootSession()).not.toThrow();
    spy.mockRestore();
  });
});
