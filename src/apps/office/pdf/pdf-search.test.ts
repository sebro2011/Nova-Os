import { describe, expect, it } from 'vitest';
import { findPdfPageMatches, pdfTextContentToString } from './pdf-search';

describe('PDF text search', () => {
  it('joins text items and skips marked-content records', () => {
    expect(pdfTextContentToString([{ str: 'NOVA' }, { type: 'beginMarkedContent' }, { str: 'PDF', hasEOL: true }, { str: 'reader' }])).toBe('NOVA PDF\nreader ');
  });

  it('finds normalized case-insensitive matches with page excerpts', () => {
    const matches = findPdfPageMatches(3, 'A   local document\nwith Orbit search.', 'orbit SEARCH');
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ pageNumber: 3 });
    expect(matches[0].excerpt).toContain('Orbit search');
  });

  it('bounds matches and rejects blank queries', () => {
    expect(findPdfPageMatches(1, 'nova nova nova', 'nova', 2)).toHaveLength(2);
    expect(findPdfPageMatches(1, 'nova', '  ')).toEqual([]);
  });
});
