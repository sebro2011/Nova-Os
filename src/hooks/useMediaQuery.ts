import { useEffect, useState } from 'react';

export const PHONE_LAYOUT_QUERY = '(max-width: 767px), (max-height: 500px) and (pointer: coarse)';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => (
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false
  ));

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      setMatches(false);
      return;
    }

    const media = window.matchMedia(query);
    const update = (event?: MediaQueryListEvent) => setMatches(event?.matches ?? media.matches);
    update();

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', update);
      return () => media.removeEventListener('change', update);
    }

    // Older mobile Safari versions expose only the legacy listener API.
    media.addListener(update);
    return () => media.removeListener(update);
  }, [query]);

  return matches;
}

export function usePhoneLayout(): boolean {
  return useMediaQuery(PHONE_LAYOUT_QUERY);
}
