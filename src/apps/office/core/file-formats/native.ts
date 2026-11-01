import { createWriterDocument, validateWriterDocument, type WriterDocument } from '../document-model/writer-model';
import { createWorkbookDocument, validateWorkbookDocument, type WorkbookDocument } from '../spreadsheet-model/workbook-model';
import { createPresentationDocument, validatePresentationDocument, type PresentationDocument } from '../presentation-model/presentation-model';
import { MAX_NATIVE_OFFICE_CHARS, officeKindFromMime, type OfficeDocumentKind, type OfficeEnvelope, type OfficeKind, type OfficeTemplate } from './constants';
import { officeRecord } from './validation';

export interface OfficeDataMap {
  writer: WriterDocument;
  sheets: WorkbookDocument;
  slides: PresentationDocument;
}
export type OfficeData = OfficeDataMap[OfficeDocumentKind];

export function createOfficeData<K extends OfficeDocumentKind>(kind: K, template: OfficeTemplate = 'blank'): OfficeDataMap[K] {
  if (kind === 'writer') return createWriterDocument(template === 'blank' ? 'blank' : template === 'meeting' ? 'meeting' : template === 'letter' ? 'letter' : 'report') as OfficeDataMap[K];
  if (kind === 'sheets') return createWorkbookDocument(template === 'budget' ? 'budget' : 'blank') as OfficeDataMap[K];
  return createPresentationDocument(template === 'pitch' ? 'pitch' : 'blank') as OfficeDataMap[K];
}

export function serializeOfficeData<K extends OfficeDocumentKind>(kind: K, data: OfficeDataMap[K]): string {
  const validated = kind === 'writer'
    ? validateWriterDocument(data)
    : kind === 'sheets'
      ? validateWorkbookDocument(data)
      : validatePresentationDocument(data);
  const envelope: OfficeEnvelope<OfficeDataMap[K]> = { format: 'nova-office', version: 1, kind, data: validated as OfficeDataMap[K] };
  const serialized = JSON.stringify(envelope);
  if (serialized.length > MAX_NATIVE_OFFICE_CHARS) throw new Error('Native Office files are limited to 12 million characters. Reduce embedded images or split the document.');
  return serialized;
}

export function parseOfficeData<K extends OfficeDocumentKind>(kind: K, content: string): OfficeDataMap[K] {
  if (content.length > MAX_NATIVE_OFFICE_CHARS) throw new Error('This native Office file exceeds the 12 million character safety limit.');
  let input: unknown;
  try {
    input = JSON.parse(content);
  } catch {
    throw new Error('This native Office file contains invalid JSON. Choose a valid NOVA Office document.');
  }
  const envelope = officeRecord(input, 'NOVA Office file');
  if (envelope.format !== 'nova-office' || envelope.version !== 1 || envelope.kind !== kind) {
    throw new Error(`This file is not a supported NOVA ${kind} version 1 document.`);
  }
  if (kind === 'writer') return validateWriterDocument(envelope.data) as OfficeDataMap[K];
  if (kind === 'sheets') return validateWorkbookDocument(envelope.data) as OfficeDataMap[K];
  return validatePresentationDocument(envelope.data) as OfficeDataMap[K];
}

export function validateNativeOfficeContent(mimeType: string, content: string): void {
  const kind = officeKindFromMime(mimeType);
  if (!kind || kind === 'pdf') return;
  parseOfficeData(kind, content);
}

export function isOfficeKind(value: unknown): value is OfficeKind {
  return ['writer', 'sheets', 'slides', 'pdf'].includes(String(value));
}
