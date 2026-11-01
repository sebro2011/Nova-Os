export function normalizeWebUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error('Enter a web address or search term.');
  if (trimmed.length > 2_000) throw new Error('Address is too long.');

  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(trimmed);
  const looksLikeUrl = hasScheme || /^localhost(?::\d+)?(?:\/|$)/i.test(trimmed) || /^[\w-]+(\.[\w-]+)+(?:[/:?#]|$)/.test(trimmed);
  if (!looksLikeUrl) {
    return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
  }

  const url = new URL(hasScheme ? trimmed : `https://${trimmed}`);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Only HTTP and HTTPS addresses are allowed.');
  }
  if (url.username || url.password) throw new Error('Addresses containing credentials are not allowed.');
  return url.toString();
}

/** Convert supported YouTube pages to their official privacy-enhanced player. */
export function getYouTubeEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || parsed.username || parsed.password) return null;

    const hostname = parsed.hostname.toLowerCase();
    const isYoutube = hostname === 'youtube.com' || hostname === 'www.youtube.com' || hostname === 'm.youtube.com';
    const isShortLink = hostname === 'youtu.be' || hostname === 'www.youtu.be';
    const isPrivacyPlayer = hostname === 'youtube-nocookie.com' || hostname === 'www.youtube-nocookie.com';
    let videoId: string | null = null;

    if (isShortLink) {
      videoId = parsed.pathname.match(/^\/([A-Za-z0-9_-]{11})\/?$/)?.[1] ?? null;
    } else if (isYoutube && /^\/watch\/?$/.test(parsed.pathname)) {
      videoId = parsed.searchParams.get('v');
    } else if (isYoutube || isPrivacyPlayer) {
      videoId = parsed.pathname.match(/^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})\/?$/)?.[1] ?? null;
    }

    if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null;
    return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&playsinline=1`;
  } catch {
    return null;
  }
}

export function getMixedContentRestriction(url: string, parentProtocol: string): string | null {
  try {
    const parsed = new URL(url);
    return parentProtocol === 'https:' && parsed.protocol === 'http:'
      ? 'This insecure HTTP address cannot be embedded inside NOVA’s HTTPS session. Open it externally so the browser can apply its own security protections.'
      : null;
  } catch {
    return null;
  }
}

/**
 * Known destination framing policies only. An iframe load event cannot reveal cross-origin
 * response headers, so unlisted sites still retain the honest compatibility fallback.
 */
export function getEmbeddingRestriction(url: string, parentOrigin?: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;

    if (parentOrigin && parsed.origin === new URL(parentOrigin).origin) {
      return 'NOVA does not embed its own application origin. This prevents recursive desktop frames and keeps the remote-content sandbox boundary intact. Open the address externally instead.';
    }

    const hostname = parsed.hostname.toLowerCase();
    const isGoogleSearch = (hostname === 'google.com' || hostname === 'www.google.com')
      && parsed.pathname.replace(/\/+$/, '') === '/search';
    if (isGoogleSearch) return 'Google Search does not allow other websites to embed its results.';

    if (hostname === 'github.com' || hostname === 'www.github.com') {
      return 'GitHub’s main website protects its pages with framing restrictions. Repository pages, issues, and account flows must be opened in a normal browser tab.';
    }

    const isMainYouTube = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'studio.youtube.com'].includes(hostname);
    if (isMainYouTube && !getYouTubeEmbedUrl(url)) {
      return 'YouTube’s main website does not permit this page to be framed. Supported video, Shorts, and live links use YouTube’s official embed player; other pages open externally.';
    }

    return null;
  } catch {
    return null;
  }
}

export function displayUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname === '/' ? '' : parsed.pathname}`;
  } catch {
    return url;
  }
}
