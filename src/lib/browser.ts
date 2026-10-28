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

/** Known hard blocks only; other sites may still refuse framed embedding. */
export function getEmbeddingRestriction(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    const hostname = parsed.hostname.toLowerCase();
    const isGoogleSearch = (hostname === 'google.com' || hostname === 'www.google.com')
      && parsed.pathname.replace(/\/+$/, '') === '/search';
    return isGoogleSearch
      ? 'Google Search does not allow other websites to embed its results.'
      : null;
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
