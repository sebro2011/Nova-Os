import type { BrowserHistoryEntry, CalendarEvent, FileNode, Note } from '../types';

const DATABASE_NAME = 'nova-web-os';
const DATABASE_VERSION = 1;

export type StoreName = 'files' | 'notes' | 'events' | 'history' | 'meta';

interface MetaRecord {
  key: string;
  value: string;
}

export interface DatabaseSnapshot {
  files: FileNode[];
  notes: Note[];
  events: CalendarEvent[];
  history: BrowserHistoryEntry[];
}

let databasePromise: Promise<IDBDatabase> | undefined;

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) {
      reject(new Error('IndexedDB is unavailable. NOVA cannot save structured data in this browser session.'));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains('files')) {
        const store = database.createObjectStore('files', { keyPath: 'id' });
        store.createIndex('parentId', 'parentId', { unique: false });
      }
      if (!database.objectStoreNames.contains('notes')) database.createObjectStore('notes', { keyPath: 'id' });
      if (!database.objectStoreNames.contains('events')) {
        const store = database.createObjectStore('events', { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
      }
      if (!database.objectStoreNames.contains('history')) database.createObjectStore('history', { keyPath: 'id' });
      if (!database.objectStoreNames.contains('meta')) database.createObjectStore('meta', { keyPath: 'key' });
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = () => reject(request.error ?? new Error('Could not open NOVA local storage.'));
    request.onblocked = () => reject(new Error('NOVA storage is blocked by another open tab. Close other NOVA tabs and retry.'));
  });
  databasePromise.catch(() => {
    databasePromise = undefined;
  });
  return databasePromise;
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Local storage transaction failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Local storage transaction was interrupted.'));
  });
}

export async function getAllRecords<T>(storeName: StoreName): Promise<T[]> {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, 'readonly');
  const request = transaction.objectStore(storeName).getAll();
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error ?? new Error(`Could not read ${storeName}.`));
  });
}

export async function getRecord<T>(storeName: StoreName, key: string): Promise<T | undefined> {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, 'readonly');
  const request = transaction.objectStore(storeName).get(key);
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error ?? new Error(`Could not read ${storeName}.`));
  });
}

export async function putRecord<T>(storeName: StoreName, value: T): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, 'readwrite');
  transaction.objectStore(storeName).put(value);
  await transactionDone(transaction);
}

export async function putRecords<T>(storeName: StoreName, values: T[]): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, 'readwrite');
  const store = transaction.objectStore(storeName);
  values.forEach((value) => store.put(value));
  await transactionDone(transaction);
}

export async function deleteRecord(storeName: StoreName, key: string): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, 'readwrite');
  transaction.objectStore(storeName).delete(key);
  await transactionDone(transaction);
}

export async function deleteRecords(storeName: StoreName, keys: string[]): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, 'readwrite');
  const store = transaction.objectStore(storeName);
  keys.forEach((key) => store.delete(key));
  await transactionDone(transaction);
}

const seedTime = '2026-01-01T00:00:00.000Z';
const seedFiles: FileNode[] = [
  { id: 'root', parentId: null, name: 'NOVA', kind: 'folder', content: '', mimeType: '', createdAt: seedTime, updatedAt: seedTime, trashed: false },
  { id: 'home', parentId: 'root', name: 'Home', kind: 'folder', content: '', mimeType: '', createdAt: seedTime, updatedAt: seedTime, trashed: false },
  { id: 'documents', parentId: 'home', name: 'Documents', kind: 'folder', content: '', mimeType: '', createdAt: seedTime, updatedAt: seedTime, trashed: false },
  { id: 'welcome-file', parentId: 'documents', name: 'Welcome.txt', kind: 'file', content: 'Welcome to NOVA Web OS.\n\nThis virtual file system lives in IndexedDB in this browser. It cannot access your Windows files unless you explicitly import them.\n\nExport a NOVA backup from Settings → Data to keep a portable copy.', mimeType: 'text/plain', createdAt: seedTime, updatedAt: seedTime, trashed: false },
  { id: 'shortcuts-file', parentId: 'documents', name: 'Shortcuts.txt', kind: 'file', content: 'Ctrl + K: Global search\nCtrl + Alt + T: Terminal\nAlt + M: Minimize active window\nAlt + W: Close active window\nF1: Help Center\nEscape: Close overlays', mimeType: 'text/plain', createdAt: seedTime, updatedAt: seedTime, trashed: false },
];

export async function initializeDatabase(): Promise<void> {
  const initialized = await getRecord<MetaRecord>('meta', 'initialized');
  if (initialized?.value === '1') return;
  const database = await openDatabase();
  const transaction = database.transaction(['files', 'notes', 'meta'], 'readwrite');
  const files = transaction.objectStore('files');
  seedFiles.forEach((file) => files.put(file));
  transaction.objectStore('notes').put({
    id: 'welcome-note',
    title: 'Welcome to your orbit',
    content: 'NOVA keeps your notes locally in this browser.\n\nCreate a note and start typing — changes save automatically. Use Settings → Data to export a backup.',
    createdAt: seedTime,
    updatedAt: seedTime,
  } satisfies Note);
  transaction.objectStore('meta').put({ key: 'initialized', value: '1' } satisfies MetaRecord);
  await transactionDone(transaction);
}

export async function getDatabaseSnapshot(): Promise<DatabaseSnapshot> {
  const [files, notes, events, history] = await Promise.all([
    getAllRecords<FileNode>('files'),
    getAllRecords<Note>('notes'),
    getAllRecords<CalendarEvent>('events'),
    getAllRecords<BrowserHistoryEntry>('history'),
  ]);
  return { files, notes, events, history };
}

export async function replaceDatabaseSnapshot(snapshot: DatabaseSnapshot): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(['files', 'notes', 'events', 'history', 'meta'], 'readwrite');
  (['files', 'notes', 'events', 'history'] as const).forEach((storeName) => {
    const store = transaction.objectStore(storeName);
    store.clear();
    snapshot[storeName].forEach((record) => store.put(record));
  });
  transaction.objectStore('meta').put({ key: 'initialized', value: '1' } satisfies MetaRecord);
  await transactionDone(transaction);
}
