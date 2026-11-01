import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearStore, getAllRecords, initializeDatabase } from '../../../lib/db';
import { defaultPreferences } from '../../../lib/preferences';
import { validateBackup } from '../../../lib/backup';
import type { FileNode } from '../../../types';
import { createOfficeFile, createPdfFile, listOfficeFiles, loadOfficeFile, saveOfficeFile } from './office-storage';
import { pdfDataUrlToBytes } from '../core/file-formats/pdf';

beforeEach(async () => {
  await clearStore('files');
  await clearStore('meta');
  await initializeDatabase();
});

describe('Office canonical file storage', () => {
  it('creates, saves, lists, and reloads one canonical Writer record', async () => {
    const created = await createOfficeFile('writer', 'Project plan', 'meeting');
    expect(created.file.name).toBe('Project plan.nwdoc');
    expect(await listOfficeFiles()).toHaveLength(1);
    const renamed = await saveOfficeFile(created.file, 'writer', created.data, 'Roadmap');
    expect(renamed.name).toBe('Roadmap.nwdoc');
    expect(await loadOfficeFile(created.file.id, 'writer')).toEqual({ file: renamed, data: created.data });
    await expect(createOfficeFile('writer', 'Roadmap')).rejects.toThrow('already exists');
  });

  it('stores PDF data locally and verifies its signature during round trips', async () => {
    const bytes = new TextEncoder().encode('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF');
    const file = await createPdfFile('Local report', bytes);
    expect(file.name).toBe('Local report.pdf');
    expect(Array.from(pdfDataUrlToBytes(file.content))).toEqual(Array.from(bytes));
    await expect(createPdfFile('Bad', new TextEncoder().encode('not a pdf'))).rejects.toThrow('valid PDF signature');
  });

  it('includes native Office and PDF records in validated version 1 backups', async () => {
    const writer = await createOfficeFile('writer', 'Backup document');
    const pdf = await createPdfFile('Backup PDF', new TextEncoder().encode('%PDF-1.7\n%%EOF'));
    const files = await getAllRecords<FileNode>('files');
    const backup = { format: 'nova-web-os-backup', version: 1, exportedAt: new Date().toISOString(), preferences: defaultPreferences, files, notes: [], events: [], history: [], bookmarks: [] } as const;
    expect(validateBackup(backup).files.find((file) => file.id === writer.file.id)?.content).toBe(writer.file.content);
    expect(validateBackup(backup).files.find((file) => file.id === pdf.id)?.content).toBe(pdf.content);
    const corrupted = { ...backup, files: files.map((file) => file.id === writer.file.id ? { ...file, content: '{bad json' } : file) };
    expect(() => validateBackup(corrupted)).toThrow('invalid JSON');
  });
});
