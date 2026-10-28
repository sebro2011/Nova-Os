import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PHONE_LAYOUT_QUERY, usePhoneLayout } from './useMediaQuery';

const originalMatchMedia = window.matchMedia;

function setMatchMedia(value: typeof window.matchMedia | undefined) {
  Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value });
}

afterEach(() => setMatchMedia(originalMatchMedia));

describe('responsive media queries', () => {
  it('tracks phone layout changes caused by resizing or rotation', () => {
    let matches = true;
    let listener: ((event: MediaQueryListEvent) => void) | undefined;
    const media = {
      media: PHONE_LAYOUT_QUERY,
      get matches() { return matches; },
      addEventListener: vi.fn((_type: string, callback: (event: MediaQueryListEvent) => void) => { listener = callback; }),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    } as unknown as MediaQueryList;
    const matchMedia = vi.fn(() => media);
    setMatchMedia(matchMedia);

    const { result, unmount } = renderHook(() => usePhoneLayout());
    expect(matchMedia).toHaveBeenCalledWith(PHONE_LAYOUT_QUERY);
    expect(result.current).toBe(true);

    act(() => {
      matches = false;
      listener?.({ matches: false } as MediaQueryListEvent);
    });
    expect(result.current).toBe(false);

    unmount();
    expect(media.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('uses the desktop layout when media queries are unavailable', () => {
    setMatchMedia(undefined);
    const { result } = renderHook(() => usePhoneLayout());
    expect(result.current).toBe(false);
  });
});
