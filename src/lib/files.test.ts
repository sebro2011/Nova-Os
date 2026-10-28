import { describe, expect, it } from 'vitest';
import { getDescendantIds, validateFileName } from './files';
import type { FileNode } from '../types';

function node(id: string, parentId: string | null): FileNode {
  return { id, parentId, name: id, kind: 'folder', content: '', mimeType: '', createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(), trashed: false };
}

describe('virtual file safety', () => {
  it('normalizes safe names and rejects traversal or separators', () => {
    expect(validateFileName('  Notes.txt  ')).toBe('Notes.txt');
    expect(() => validateFileName('../secret')).toThrow();
    expect(() => validateFileName('..')).toThrow('reserved');
    expect(() => validateFileName('')).toThrow('Enter a name');
  });

  it('finds all descendants for safe Trash operations', () => {
    const files = [node('root', null), node('folder', 'root'), node('child', 'folder'), node('other', 'root')];
    expect([...getDescendantIds('folder', files)].sort()).toEqual(['child', 'folder']);
  });
});
