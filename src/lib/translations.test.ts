import { describe, expect, it } from 'vitest';
import { messages, translate } from './translations';
import { sanitizePreferences } from './preferences';

describe('shared NOVA localization', () => {
  it('provides complete English, Sinhala, and Tamil messages with matching placeholders', () => {
    for (const entry of Object.values(messages)) {
      expect(entry.en.trim().length).toBeGreaterThan(0);
      expect(entry.si.trim().length).toBeGreaterThan(0);
      expect(entry.ta.trim().length).toBeGreaterThan(0);
      const placeholders = (text: string) => [...text.matchAll(/\{[^}]+\}/g)].map((match) => match[0]).sort();
      expect(placeholders(entry.si)).toEqual(placeholders(entry.en));
      expect(placeholders(entry.ta)).toEqual(placeholders(entry.en));
    }
  });

  it('interpolates bounded UI values and migrates unsupported languages to English', () => {
    expect(translate('si', 'writer.words', { count: 12 })).toBe('වචන 12');
    expect(translate('ta', 'pdf.pageOf', { page: 2, total: 8 })).toBe('8 இல் 2 பக்கம்');
    expect(sanitizePreferences({ language: 'si' }).language).toBe('si');
    expect(sanitizePreferences({ language: 'ta' }).language).toBe('ta');
    expect(sanitizePreferences({ language: 'unsupported' }).language).toBe('en');
    expect(sanitizePreferences({}).language).toBe('en');
  });
});
