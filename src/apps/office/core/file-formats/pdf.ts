import { MAX_PDF_BYTES, MAX_PDF_DATA_URL_CHARS } from './constants';

export function validatePdfBytes(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 8 || bytes.length > MAX_PDF_BYTES) throw new Error('PDF files must be between 8 bytes and 20 MB.');
  const signature = new TextDecoder().decode(bytes.subarray(0, 5));
  if (signature !== '%PDF-') throw new Error('The selected file does not contain a valid PDF signature.');
  return bytes;
}

export function pdfBytesToDataUrl(bytes: Uint8Array): string {
  validatePdfBytes(bytes);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return `data:application/pdf;base64,${btoa(binary)}`;
}

export function validatePdfDataUrl(value: string): string {
  if (value.length > MAX_PDF_DATA_URL_CHARS || !value.startsWith('data:application/pdf;base64,')) {
    throw new Error('PDF records must be bounded PDF data URLs.');
  }
  const payload = value.slice('data:application/pdf;base64,'.length);
  if (!payload || payload.length % 4 !== 0 || !/^[a-z\d+/]*={0,2}$/i.test(payload)) throw new Error('PDF data is not valid base64.');
  const estimatedBytes = Math.floor(payload.length * 3 / 4) - (payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0);
  if (estimatedBytes > MAX_PDF_BYTES) throw new Error('PDF records are limited to 20 MB.');
  const prefix = atob(payload.slice(0, 12));
  if (!prefix.startsWith('%PDF-')) throw new Error('PDF data does not contain a valid signature.');
  return value;
}

export function pdfDataUrlToBytes(value: string): Uint8Array {
  validatePdfDataUrl(value);
  const binary = atob(value.slice('data:application/pdf;base64,'.length));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return validatePdfBytes(bytes);
}
