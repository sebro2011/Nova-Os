export const OFFICE_MIME = {
  writer: 'application/x-nova-writer+json',
  sheets: 'application/x-nova-sheets+json',
  slides: 'application/x-nova-slides+json',
  pdf: 'application/pdf',
} as const;

export const OFFICE_EXTENSION = {
  writer: '.nwdoc',
  sheets: '.nwsheet',
  slides: '.nwslides',
  pdf: '.pdf',
} as const;

export type OfficeDocumentKind = Exclude<keyof typeof OFFICE_MIME, 'pdf'>;
export type OfficeKind = keyof typeof OFFICE_MIME;
export type OfficeTemplate = 'blank' | 'meeting' | 'letter' | 'budget' | 'report' | 'pitch';

export interface OfficeEnvelope<T> {
  format: 'nova-office';
  version: 1;
  kind: OfficeDocumentKind;
  data: T;
}

export const MAX_NATIVE_OFFICE_CHARS = 12_000_000;
export const MAX_PDF_BYTES = 20 * 1024 * 1024;
export const MAX_PDF_DATA_URL_CHARS = 28_000_000;
export const MAX_OFFICE_IMAGE_CHARS = 6_000_000;

export function officeKindFromMime(mimeType: string): OfficeKind | null {
  const entry = Object.entries(OFFICE_MIME).find(([, mime]) => mime === mimeType);
  return (entry?.[0] as OfficeKind | undefined) ?? null;
}

export function isNativeOfficeMime(mimeType: string): boolean {
  return ['writer', 'sheets', 'slides'].includes(officeKindFromMime(mimeType) ?? '');
}
