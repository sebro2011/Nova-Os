import { describe, expect, it } from 'vitest';
import { normalizeWebsiteUrl, validateWebsiteShortcuts } from './websites';
import type { WebsiteShortcut } from '../types';

const now = new Date().toISOString();
const website: WebsiteShortcut = {
  id: 'website-one',
  name: 'Example',
  url: 'https://example.com/docs',
  icon: null,
  showOnDesktop: true,
  createdAt: now,
};

describe('website shortcut validation', () => {
  it('normalizes safe addresses without converting them to searches', () => {
    expect(normalizeWebsiteUrl('example.com/docs')).toBe('https://example.com/docs');
    expect(() => normalizeWebsiteUrl('javascript:alert(1)')).toThrow('HTTP and HTTPS');
    expect(() => normalizeWebsiteUrl('https://user:secret@example.com')).toThrow('credentials');
  });

  it('reconstructs bounded records and defaults legacy desktop visibility', () => {
    const legacy = { ...website, name: '  Example site  ', showOnDesktop: undefined };
    expect(validateWebsiteShortcuts([legacy])[0]).toMatchObject({ name: 'Example site', showOnDesktop: true, icon: null });
  });

  it('rejects active icon formats and duplicate IDs', () => {
    expect(() => validateWebsiteShortcuts([{ ...website, icon: 'data:image/svg+xml;base64,AAAA' }])).toThrow('raster');
    expect(() => validateWebsiteShortcuts([website, website])).toThrow('duplicate ID');
    expect(validateWebsiteShortcuts([{ ...website, icon: 'data:image/png;base64,AAAA' }])[0].icon).toBe('data:image/png;base64,AAAA');
  });
});
