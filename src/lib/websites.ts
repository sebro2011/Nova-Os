import type { WebsiteShortcut } from '../types';
import { sanitizeRasterDataUrl } from './image';

export const MAX_WEBSITE_SHORTCUTS = 50;

export function normalizeWebsiteName(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Website name is required.');
  const name = value.trim();
  if (!name || name.length > 80 || /[\u0000-\u001f]/.test(name)) {
    throw new Error('Website name must contain 1–80 printable characters.');
  }
  return name;
}

/** Website shortcuts require an address; unlike Browser search, terms are never converted to a search URL. */
export function normalizeWebsiteUrl(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Website URL is required.');
  const input = value.trim();
  if (!input || input.length > 2_000) throw new Error('Website URL must contain 1–2,000 characters.');
  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(input);
  let parsed: URL;
  try {
    parsed = new URL(hasScheme ? input : `https://${input}`);
  } catch {
    throw new Error('Enter a valid website address.');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Website shortcuts allow only HTTP and HTTPS addresses.');
  }
  if (parsed.username || parsed.password) throw new Error('Website addresses containing credentials are not allowed.');
  return parsed.toString();
}

function websiteIcon(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const icon = sanitizeRasterDataUrl(value);
  if (!icon) throw new Error('Website icons must be bounded PNG or WebP raster data.');
  return icon;
}

/** Reconstructs bounded plain records for backups; imported names remain text, never HTML. */
export function validateWebsiteShortcuts(value: unknown): WebsiteShortcut[] {
  if (!Array.isArray(value) || value.length > MAX_WEBSITE_SHORTCUTS) {
    throw new Error(`Website shortcuts must be an array with at most ${MAX_WEBSITE_SHORTCUTS} items.`);
  }
  const ids = new Set<string>();
  return value.map((item, index) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) throw new Error(`Website ${index + 1} must be an object.`);
    const input = item as Record<string, unknown>;
    if (typeof input.id !== 'string' || !input.id || input.id.length > 140 || ids.has(input.id)) {
      throw new Error(`Website ${index + 1} has an invalid or duplicate ID.`);
    }
    ids.add(input.id);
    if (typeof input.createdAt !== 'string' || input.createdAt.length > 40 || Number.isNaN(Date.parse(input.createdAt))) {
      throw new Error(`Website ${index + 1} has an invalid creation date.`);
    }
    return {
      id: input.id,
      name: normalizeWebsiteName(input.name),
      url: normalizeWebsiteUrl(input.url),
      icon: websiteIcon(input.icon),
      showOnDesktop: input.showOnDesktop !== false,
      createdAt: input.createdAt,
    };
  });
}
