import { getAllRecords, getRecord, initializeDatabase, putRecord } from '../../../lib/db';
import { validateFileName } from '../../../lib/files';
import { createId } from '../../../lib/utils';
import type { FileNode } from '../../../types';
import { OFFICE_EXTENSION, OFFICE_MIME, officeKindFromMime, type OfficeDocumentKind, type OfficeKind, type OfficeTemplate } from '../core/file-formats/constants';
import { createOfficeData, parseOfficeData, serializeOfficeData, type OfficeDataMap } from '../core/file-formats/native';
import { pdfBytesToDataUrl } from '../core/file-formats/pdf';

export const OFFICE_FILES_CHANGED_EVENT = 'nova:office-files-changed';

export function notifyOfficeFilesChanged(): void {
  window.dispatchEvent(new Event(OFFICE_FILES_CHANGED_EVENT));
  window.dispatchEvent(new Event('nova:files-changed'));
}

export function isOfficeFile(file: FileNode): boolean {
  return file.kind === 'file' && officeKindFromMime(file.mimeType) !== null;
}

export async function listOfficeFiles(includeTrashed = false): Promise<FileNode[]> {
  await initializeDatabase();
  const files = await getAllRecords<FileNode>('files');
  return files.filter((file) => isOfficeFile(file) && (includeTrashed || !file.trashed)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function withOfficeExtension(name: string, kind: OfficeKind): string {
  const validName = validateFileName(name);
  return validName.toLowerCase().endsWith(OFFICE_EXTENSION[kind]) ? validName : `${validName}${OFFICE_EXTENSION[kind]}`;
}

async function assertUniqueName(name: string, parentId: string, excludeId?: string): Promise<void> {
  const files = await getAllRecords<FileNode>('files');
  if (files.some((file) => file.id !== excludeId && !file.trashed && file.parentId === parentId && file.name.toLowerCase() === name.toLowerCase())) {
    throw new Error(`An item named “${name}” already exists in this folder.`);
  }
}

async function defaultParentId(): Promise<string> {
  const files = await getAllRecords<FileNode>('files');
  if (files.some((file) => file.id === 'documents' && file.kind === 'folder' && !file.trashed)) return 'documents';
  if (files.some((file) => file.id === 'home' && file.kind === 'folder' && !file.trashed)) return 'home';
  return 'root';
}

export async function createOfficeFile<K extends OfficeDocumentKind>(kind: K, name: string, template: OfficeTemplate = 'blank', parentId?: string, autoRename = false): Promise<{ file: FileNode; data: OfficeDataMap[K] }> {
  await initializeDatabase();
  const data = createOfficeData(kind, template);
  const parent = parentId ?? await defaultParentId();
  let fileName = withOfficeExtension(name, kind);
  if (autoRename) {
    const siblings = await getAllRecords<FileNode>('files');
    const names = new Set(siblings.filter((file) => !file.trashed && file.parentId === parent).map((file) => file.name.toLowerCase()));
    const extension = OFFICE_EXTENSION[kind];
    const base = fileName.slice(0, -extension.length);
    let suffix = 2;
    while (names.has(fileName.toLowerCase()) && suffix < 10_000) {
      fileName = `${base} ${suffix}${extension}`;
      suffix += 1;
    }
    if (names.has(fileName.toLowerCase())) throw new Error('Too many documents use this name. Choose a different name.');
  } else await assertUniqueName(fileName, parent);
  const now = new Date().toISOString();
  const file: FileNode = {
    id: createId('office'), parentId: parent, name: fileName, kind: 'file',
    content: serializeOfficeData(kind, data), mimeType: OFFICE_MIME[kind],
    createdAt: now, updatedAt: now, trashed: false,
  };
  await putRecord('files', file);
  notifyOfficeFilesChanged();
  return { file, data };
}

export async function loadOfficeFile<K extends OfficeDocumentKind>(id: string, kind: K): Promise<{ file: FileNode; data: OfficeDataMap[K] }> {
  const file = await getRecord<FileNode>('files', id);
  if (!file || file.kind !== 'file' || file.mimeType !== OFFICE_MIME[kind]) throw new Error('The requested Office file no longer exists or has a different format.');
  if (file.trashed) throw new Error('Restore this file from Trash before opening it.');
  return { file, data: parseOfficeData(kind, file.content) };
}

export async function saveOfficeFile<K extends OfficeDocumentKind>(file: FileNode, kind: K, data: OfficeDataMap[K], name?: string): Promise<FileNode> {
  if (file.trashed) throw new Error('Restore this file from Trash before saving changes.');
  const nextName = withOfficeExtension(name === undefined ? file.name : name, kind);
  if (nextName !== file.name) await assertUniqueName(nextName, file.parentId ?? await defaultParentId(), file.id);
  const updated: FileNode = { ...file, name: nextName, content: serializeOfficeData(kind, data), updatedAt: new Date().toISOString() };
  await putRecord('files', updated);
  notifyOfficeFilesChanged();
  return updated;
}

export async function createPdfFile(name: string, bytes: Uint8Array, parentId?: string): Promise<FileNode> {
  await initializeDatabase();
  const parent = parentId ?? await defaultParentId();
  const fileName = withOfficeExtension(name, 'pdf');
  await assertUniqueName(fileName, parent);
  const now = new Date().toISOString();
  const file: FileNode = { id: createId('office-pdf'), parentId: parent, name: fileName, kind: 'file', content: pdfBytesToDataUrl(bytes), mimeType: OFFICE_MIME.pdf, createdAt: now, updatedAt: now, trashed: false };
  await putRecord('files', file);
  notifyOfficeFilesChanged();
  return file;
}
