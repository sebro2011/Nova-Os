import type { FileNode } from '../types';

export function validateFileName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Enter a name.');
  if (trimmed.length > 80) throw new Error('Names must be 80 characters or fewer.');
  if (trimmed === '.' || trimmed === '..') throw new Error('That name is reserved.');
  if (/[\\/<>:"|?*\u0000-\u001f]/.test(trimmed)) {
    throw new Error('Names cannot contain slashes, colons, or control characters.');
  }
  return trimmed;
}

export function getFolderPath(folderId: string, files: FileNode[]): FileNode[] {
  const path: FileNode[] = [];
  const visited = new Set<string>();
  let current = files.find((file) => file.id === folderId && file.kind === 'folder');
  while (current && !visited.has(current.id)) {
    path.unshift(current);
    visited.add(current.id);
    current = current.parentId
      ? files.find((file) => file.id === current?.parentId && file.kind === 'folder')
      : undefined;
  }
  return path;
}

export function getDescendantIds(folderId: string, files: FileNode[]): Set<string> {
  const ids = new Set<string>([folderId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const file of files) {
      if (file.parentId && ids.has(file.parentId) && !ids.has(file.id)) {
        ids.add(file.id);
        changed = true;
      }
    }
  }
  return ids;
}

export function wouldCreateCycle(folderId: string, destinationId: string, files: FileNode[]): boolean {
  return getDescendantIds(folderId, files).has(destinationId);
}
