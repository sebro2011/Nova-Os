import { describe, expect, it } from 'vitest';
import { getEmbeddingRestriction, getMixedContentRestriction, getYouTubeEmbedUrl, normalizeWebUrl } from './browser';

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

describe('known frame embedding restrictions', () => {
  it('marks Google Search as external-only instead of rendering its blocked frame', () => {
    expect(getEmbeddingRestriction('https://www.google.com/search?q=nova')).toContain('Google Search');
    expect(getEmbeddingRestriction('https://google.com/search?q=nova')).toContain('Google Search');
  });

  it('requires external opening for insecure HTTP frames inside HTTPS', () => {
    expect(getMixedContentRestriction('http://example.com', 'https:')).toContain('insecure HTTP');
    expect(getMixedContentRestriction('http://localhost:5173', 'http:')).toBeNull();
    expect(getMixedContentRestriction('https://example.com', 'https:')).toBeNull();
  });

  it('uses external navigation for GitHub and non-video YouTube pages', () => {
    expect(getEmbeddingRestriction('https://github.com/sebro2011/Nova-Os')).toContain('GitHub');
    expect(getEmbeddingRestriction('https://www.youtube.com/')).toContain('YouTube');
    expect(getEmbeddingRestriction('https://studio.youtube.com/')).toContain('YouTube');
    expect(getEmbeddingRestriction('https://www.youtube.com/watch?v=w2pSFFG0AzY')).toBeNull();
  });

  it('prevents recursive same-origin frames without blocking lookalike origins', () => {
    expect(getEmbeddingRestriction('https://nova.example/window', 'https://nova.example')).toContain('own application origin');
    expect(getEmbeddingRestriction('https://nova.example.evil.test/', 'https://nova.example')).toBeNull();
  });

  it('does not classify other addresses as external-only', () => {
    expect(getEmbeddingRestriction('https://www.google.com/')).toBeNull();
    expect(getEmbeddingRestriction('https://maps.google.com/')).toBeNull();
    expect(getEmbeddingRestriction('https://www.wikipedia.org/')).toBeNull();
    expect(getEmbeddingRestriction('nova://home')).toBeNull();
  });
});

describe('YouTube embedded player adaptation', () => {
  it('converts watch, mobile, short, and share links to the privacy-enhanced player', () => {
    const expected = 'https://www.youtube-nocookie.com/embed/w2pSFFG0AzY?rel=0&playsinline=1';
    expect(getYouTubeEmbedUrl('https://www.youtube.com/watch?v=w2pSFFG0AzY')).toBe(expected);
    expect(getYouTubeEmbedUrl('https://m.youtube.com/watch?v=w2pSFFG0AzY')).toBe(expected);
    expect(getYouTubeEmbedUrl('https://youtu.be/w2pSFFG0AzY')).toBe(expected);
    expect(getYouTubeEmbedUrl('https://www.youtube.com/shorts/w2pSFFG0AzY')).toBe(expected);
    expect(getYouTubeEmbedUrl('https://www.youtube.com/embed/w2pSFFG0AzY')).toBe(expected);
  });

  it('does not adapt invalid video IDs, unrelated pages, or lookalike hosts', () => {
    expect(getYouTubeEmbedUrl('https://www.youtube.com/watch?v=invalid')).toBeNull();
    expect(getYouTubeEmbedUrl('https://www.youtube.com/')).toBeNull();
    expect(getYouTubeEmbedUrl('https://youtube.com.evil.example/watch?v=w2pSFFG0AzY')).toBeNull();
    expect(getYouTubeEmbedUrl('https://example.com/watch?v=w2pSFFG0AzY')).toBeNull();
    expect(getYouTubeEmbedUrl('nova://home')).toBeNull();
  });
});
