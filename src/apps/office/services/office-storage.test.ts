import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearStore, getAllRecords, initializeDatabase } from '../../../lib/db';
import { defaultPreferences } from '../../../lib/preferences';
import { validateBackup } from '../../../lib/backup';
import type { FileNode } from '../../../types';
import { createOfficeFile, createPdfFile, listOfficeFiles, loadOfficeFile, saveOfficeFile } from './office-storage';
import { pdfDataUrlToBytes } from '../core/file-formats/pdf';
import { officeAppForMime } from './office-navigation';

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

  it('automatically suffixes repeated untitled documents without overwriting either record', async () => {
    const first = await createOfficeFile('writer', 'Untitled document', 'blank', undefined, true);
    const second = await createOfficeFile('writer', 'Untitled document', 'blank', undefined, true);
    expect(first.file.name).toBe('Untitled document.nwdoc');
    expect(second.file.name).toBe('Untitled document 2.nwdoc');
    expect(second.file.id).not.toBe(first.file.id);
    expect(await listOfficeFiles()).toHaveLength(2);
  });

  it('round-trips a budget workbook and routes its canonical file back to Sheets', async () => {
    const created = await createOfficeFile('sheets', 'Household budget', 'budget');
    expect(created.file.name).toBe('Household budget.nwsheet');
    expect(officeAppForMime(created.file.mimeType)).toBe('sheets');
    const loaded = await loadOfficeFile(created.file.id, 'sheets');
    expect(loaded.data).toEqual(created.data);
    expect(loaded.data.sheets[0].cells.B5.value).toBe('=SUM(B2:B4)');
  });

  it('round-trips a pitch presentation and routes its canonical file back to Slides', async () => {
    const created = await createOfficeFile('slides', 'Product pitch', 'pitch');
    expect(created.file.name).toBe('Product pitch.nwslides');
    expect(officeAppForMime(created.file.mimeType)).toBe('slides');
    const loaded = await loadOfficeFile(created.file.id, 'slides');
    expect(loaded.data).toEqual(created.data);
    expect(loaded.data.slides[0].layout).toBe('title');
  });

  it('stores PDF data locally and verifies its signature during round trips', async () => {
    const bytes = new TextEncoder().encode('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF');
    const file = await createPdfFile('Local report', bytes);
    expect(file.name).toBe('Local report.pdf');
    expect(officeAppForMime(file.mimeType)).toBe('pdf');
    const duplicate = await createPdfFile('Local report', bytes, undefined, true);
    expect(duplicate.name).toBe('Local report 2.pdf');
    expect(Array.from(pdfDataUrlToBytes(file.content))).toEqual(Array.from(bytes));
    await expect(createPdfFile('Bad', new TextEncoder().encode('not a pdf'))).rejects.toThrow('valid PDF signature');
  });

  it('includes native Office and PDF records in validated version 1 backups', async () => {
    const writer = await createOfficeFile('writer', 'Backup document');
    const sheets = await createOfficeFile('sheets', 'Backup workbook', 'budget');
    const slides = await createOfficeFile('slides', 'Backup presentation', 'pitch');
    const pdf = await createPdfFile('Backup PDF', new TextEncoder().encode('%PDF-1.7\n%%EOF'));
    const files = await getAllRecords<FileNode>('files');
    const backup = { format: 'nova-web-os-backup', version: 1, exportedAt: new Date().toISOString(), preferences: defaultPreferences, files, notes: [], events: [], history: [], bookmarks: [] } as const;
    expect(validateBackup(backup).files.find((file) => file.id === writer.file.id)?.content).toBe(writer.file.content);
    expect(validateBackup(backup).files.find((file) => file.id === sheets.file.id)?.content).toBe(sheets.file.content);
    expect(validateBackup(backup).files.find((file) => file.id === slides.file.id)?.content).toBe(slides.file.content);
    expect(validateBackup(backup).files.find((file) => file.id === pdf.id)?.content).toBe(pdf.content);
    const corrupted = { ...backup, files: files.map((file) => file.id === writer.file.id ? { ...file, content: '{bad json' } : file) };
    expect(() => validateBackup(corrupted)).toThrow('invalid JSON');
  });
});
