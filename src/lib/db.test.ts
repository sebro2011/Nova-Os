import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAllRecords, getRecord, initializeDatabase, putRecord } from './db';
import type { FileNode, Note } from '../types';

async function reset() {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('nova-web-os');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Test database deletion was blocked.'));
  });
}

beforeEach(reset);

describe('IndexedDB integration', () => {
  it('seeds required folders and persists structured records', async () => {
    await initializeDatabase();
    const files = await getAllRecords<FileNode>('files');
    expect(files).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'root', kind: 'folder' }),
      expect.objectContaining({ id: 'home', parentId: 'root', kind: 'folder' }),
    ]));
    const note: Note = { id: 'note-test', title: 'Saved', content: 'IndexedDB', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await putRecord('notes', note);
    expect(await getRecord<Note>('notes', note.id)).toEqual(note);
  });

  it('reopens instead of reusing a connection closed by versionchange', async () => {
    const connections: IDBDatabase[] = [];
    const originalOpen = indexedDB.open.bind(indexedDB);
    vi.spyOn(indexedDB, 'open').mockImplementation((name, version) => {
      const request = originalOpen(name, version);
      request.addEventListener('success', () => connections.push(request.result));
      return request;
    });
    await initializeDatabase();
    expect(connections).toHaveLength(1);
    connections[0].onversionchange?.(new Event('versionchange') as IDBVersionChangeEvent);
    await getAllRecords('notes');
    expect(connections).toHaveLength(2);
    expect(connections[1]).not.toBe(connections[0]);
  });
});
