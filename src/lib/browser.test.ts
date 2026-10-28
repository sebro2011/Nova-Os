import { describe, expect, it } from 'vitest';
import { normalizeWebUrl } from './browser';

describe('browser address normalization', () => {
  it('accepts HTTP and HTTPS addresses', () => {
    expect(normalizeWebUrl('example.com')).toBe('https://example.com/');
    expect(normalizeWebUrl('http://localhost:5173')).toBe('http://localhost:5173/');
  });

  it('turns plain terms into an encoded web search', () => {
    expect(normalizeWebUrl('nova web os')).toBe('https://www.google.com/search?q=nova%20web%20os');
  });

  it('blocks active-content schemes and credential URLs', () => {
    expect(() => normalizeWebUrl('javascript:alert(1)')).toThrow('Only HTTP and HTTPS');
    expect(() => normalizeWebUrl('data:text/html,hello')).toThrow('Only HTTP and HTTPS');
    expect(() => normalizeWebUrl('https://user:secret@example.com')).toThrow('credentials');
  });
});
