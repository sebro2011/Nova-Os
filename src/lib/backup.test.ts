import { describe, expect, it } from 'vitest';
import { MAX_BACKUP_FILE_BYTES, serializeBackup, validateBackup } from './backup';
import { defaultPreferences } from './preferences';
import type { FileNode, NovaBackup } from '../types';

const now = new Date().toISOString();
const root: FileNode = { id: 'root', parentId: null, name: 'NOVA', kind: 'folder', content: '', mimeType: '', createdAt: now, updatedAt: now, trashed: false };

function backup(): NovaBackup {
  return { format: 'nova-web-os-backup', version: 1, exportedAt: now, preferences: { ...defaultPreferences }, files: [root], notes: [], events: [], history: [], bookmarks: [] };
}

describe('backup validation', () => {
  it('accepts and reconstructs a valid backup', () => {
    const result = validateBackup(backup());
    expect(result.format).toBe('nova-web-os-backup');
    expect(result.files).toHaveLength(2);
    expect(result.files[0]).not.toBe(root);
    expect(result.files[1]).toEqual(expect.objectContaining({ id: 'home', parentId: 'root', kind: 'folder' }));
  });

  it('rejects unsupported formats and missing roots', () => {
    expect(() => validateBackup({ ...backup(), version: 2 })).toThrow('supported');
    expect(() => validateBackup({ ...backup(), files: [] })).toThrow('root folder');
  });

  it('rejects active-content URLs in imported history', () => {
    const value = { ...backup(), history: [{ id: 'bad', url: 'javascript:alert(1)', title: 'Bad', visitedAt: now }] };
    expect(() => validateBackup(value)).toThrow();
  });

  it('rejects duplicate IDs and invalid event dates', () => {
    const duplicate = { ...backup(), notes: [{ id: 'root', title: '', content: '', createdAt: now, updatedAt: now }] };
    expect(validateBackup(duplicate)).toBeDefined(); // IDs are scoped per collection.
    const invalidEvent = { ...backup(), events: [{ id: 'event', title: 'Invalid', date: '2026-02-30', time: '', details: '', createdAt: now }] };
    expect(() => validateBackup(invalidEvent)).toThrow('invalid date');
  });

  it('accepts legacy backups without bookmarks and rejects unsafe bookmark URLs', () => {
    const legacy = backup() as Partial<NovaBackup>;
    delete legacy.bookmarks;
    expect(validateBackup(legacy).bookmarks).toEqual([]);
    const unsafe = { ...backup(), bookmarks: [{ id: 'bookmark', url: 'data:text/html,unsafe', title: 'Unsafe', createdAt: now }] };
    expect(() => validateBackup(unsafe)).toThrow('unsafe URL');
  });

  it('serializes backups with the same size contract used by import', () => {
    const value = backup();
    value.notes = Array.from({ length: 9 }, (_, index) => ({ id: `large-note-${index}`, title: 'Large', content: 'x'.repeat(1_000_000), createdAt: now, updatedAt: now }));
    const serialized = serializeBackup(value);
    expect(new TextEncoder().encode(serialized).byteLength).toBeGreaterThan(8 * 1024 * 1024);
    expect(new TextEncoder().encode(serialized).byteLength).toBeLessThan(MAX_BACKUP_FILE_BYTES);
    expect(validateBackup(JSON.parse(serialized)).notes[0].content).toHaveLength(1_000_000);
  });

  it('does not render or execute imported HTML-like text', () => {
    const value = backup();
    value.notes = [{ id: 'note', title: '<img src=x onerror=alert(1)>', content: '<script>alert(1)</script>', createdAt: now, updatedAt: now }];
    const result = validateBackup(value);
    expect(result.notes[0].content).toBe('<script>alert(1)</script>');
  });
});
