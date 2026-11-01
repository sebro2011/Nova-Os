import { generateJSON } from '@tiptap/core';
import type mammothType from 'mammoth';
import { writerExtensions } from './writer-schema';
import { validateWriterDocument, type WriterDocument, type WriterPageSetup } from '../core/document-model/writer-model';
import { decodeOoxmlText, extractOoxml, hasOoxmlMacro, type OoxmlArchive } from '../core/file-formats/ooxml';
import { readRasterInfo } from '../core/file-formats/raster';

export const MAX_DOCX_FILE_BYTES = 15_000_000;
export const MAX_TXT_FILE_CHARS = 2_000_000;

export interface WriterImportResult {
  document: WriterDocument;
  warnings: string[];
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

type MammothInput = Parameters<typeof mammothType.convertToHtml>[0];

function verifiedMammothInput(archive: OoxmlArchive): MammothInput {
  // Mammoth 1.13's runtime accepts this ZIP adapter; its public TS input union omits it.
  const file = {
    exists: (name: string) => archive.files[name] !== undefined,
    read: async (name: string, encoding?: string) => {
      const bytes = archive.files[name];
      if (!bytes) throw new Error(`Verified DOCX entry is missing: ${name}`);
      if (encoding === 'base64') return bytesToBase64(bytes);
      if (encoding) return new TextDecoder(encoding).decode(bytes);
      return bytes;
    },
    write: () => { throw new Error('DOCX import is read-only.'); },
    toArrayBuffer: () => { throw new Error('DOCX import does not rewrite archives.'); },
  };
  return { file } as unknown as MammothInput;
}

const activeElements = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'BASE', 'FORM', 'INPUT', 'BUTTON', 'VIDEO', 'AUDIO', 'CANVAS']);
const allowedElements = new Set(['P', 'BR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'STRIKE', 'UL', 'OL', 'LI', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH', 'IMG', 'A', 'BLOCKQUOTE', 'PRE', 'CODE', 'SPAN', 'DIV', 'HR']);

function cleanStyle(value: string): { value: string; dropped: boolean } {
  const output: string[] = [];
  let dropped = false;
  for (const declaration of value.split(';').slice(0, 30)) {
    const separator = declaration.indexOf(':');
    if (separator < 1) continue;
    const property = declaration.slice(0, separator).trim().toLowerCase();
    const raw = declaration.slice(separator + 1).trim();
    if (property === 'color' && /^#[\da-f]{3,8}$/i.test(raw)) output.push(`color:${raw}`);
    else if (property === 'font-family' && /^[\w\s,"'-]{1,80}$/.test(raw)) output.push(`font-family:${raw}`);
    else if (property === 'font-size') {
      const match = /^(\d{1,2}(?:\.\d)?)(px|pt)$/i.exec(raw);
      const pixels = match ? Number.parseFloat(match[1]) * (match[2].toLowerCase() === 'pt' ? 96 / 72 : 1) : 0;
      if (pixels >= 8 && pixels <= 96) output.push(`font-size:${Math.round(pixels * 10) / 10}px`);
      else dropped = true;
    } else if (property === 'text-align' && /^(left|center|right|justify)$/i.test(raw)) output.push(`text-align:${raw.toLowerCase()}`);
    else if (property === 'font-weight' && /^(bold|normal|[1-9]00)$/i.test(raw)) output.push(`font-weight:${raw.toLowerCase()}`);
    else if (property === 'font-style' && /^(italic|normal)$/i.test(raw)) output.push(`font-style:${raw.toLowerCase()}`);
    else if ((property === 'text-decoration' || property === 'text-decoration-line') && /^(underline|line-through|none)(\s+(underline|line-through))?$/i.test(raw)) output.push(`text-decoration:${raw.toLowerCase()}`);
    else if (property) dropped = true;
  }
  return { value: output.join(';'), dropped };
}

export function sanitizeImportedHtml(html: string): { html: string; warnings: string[] } {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const warnings = new Set<string>();
  for (const element of [...document.body.querySelectorAll('*')]) {
    if (!element.isConnected) continue;
    if (activeElements.has(element.tagName)) {
      element.remove();
      warnings.add('Active or embedded DOCX content was not imported.');
      continue;
    }
    if (!allowedElements.has(element.tagName)) {
      element.replaceWith(...element.childNodes);
      warnings.add('Some unsupported DOCX formatting was simplified while preserving its text.');
      continue;
    }
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      const keep = (element.tagName === 'A' && name === 'href')
        || (element.tagName === 'IMG' && ['src', 'alt', 'title'].includes(name))
        || ((element.tagName === 'TD' || element.tagName === 'TH') && ['colspan', 'rowspan'].includes(name))
        || (element.tagName === 'OL' && name === 'start')
        || name === 'style';
      if (!keep) element.removeAttribute(attribute.name);
    }
    if (element.tagName === 'A') {
      const href = element.getAttribute('href') ?? '';
      if (!/^(https?:\/\/|mailto:)/i.test(href) || href.length > 2048) {
        element.removeAttribute('href');
        if (href) warnings.add('Unsafe or unsupported links were removed from the DOCX import.');
      } else {
        element.setAttribute('target', '_blank');
        element.setAttribute('rel', 'noopener noreferrer nofollow');
      }
    }
    if (element.tagName === 'IMG') {
      const src = element.getAttribute('src') ?? '';
      try {
        if (src.length > 6_000_000) throw new Error('Image is too large.');
        readRasterInfo(src);
      } catch {
        element.remove();
        warnings.add('Remote, linked, unsafe, or unsupported DOCX images were not imported.');
        continue;
      }
    }
    const style = element.getAttribute('style');
    if (style !== null) {
      const cleaned = cleanStyle(style);
      if (cleaned.value) element.setAttribute('style', cleaned.value);
      else element.removeAttribute('style');
      if (cleaned.dropped) warnings.add('Some DOCX colors, spacing, fonts, or layout settings are not supported and were simplified.');
    }
  }
  return { html: document.body.innerHTML, warnings: [...warnings].slice(0, 20) };
}

function importedDocxEntry(name: string): boolean {
  return ['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/_rels/document.xml.rels', 'word/styles.xml', 'word/numbering.xml', 'word/footnotes.xml', 'word/endnotes.xml', 'word/comments.xml'].includes(name)
    || /^word\/media\/[^/]{1,160}$/i.test(name);
}

export async function importDocx(file: File, page: WriterPageSetup): Promise<WriterImportResult> {
  if (file.size > MAX_DOCX_FILE_BYTES) throw new Error('DOCX imports are limited to 15 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const archive = await extractOoxml(bytes, importedDocxEntry, { maxEntries: 250, maxEntryBytes: 6_000_000, maxTotalBytes: 32_000_000 });
  decodeOoxmlText(archive.files['word/document.xml'], 'word/document.xml');
  const mammoth = await import('mammoth');
  const result = await mammoth.convertToHtml(verifiedMammothInput(archive), {
    externalFileAccess: false,
    includeDefaultStyleMap: true,
    includeEmbeddedStyleMap: true,
  });
  const sanitized = sanitizeImportedHtml(result.value);
  const warnings = new Set<string>(sanitized.warnings);
  result.messages.slice(0, 20).forEach((message) => warnings.add(message.message.slice(0, 300)));
  if (hasOoxmlMacro(archive.entries)) warnings.add('Macros, ActiveX, and embedded objects were not imported or executed.');
  if (archive.entries.some((name) => /^word\/(?:header|footer)\d*\.xml$/i.test(name))) warnings.add('DOCX section headers and footers were not mapped automatically; review NOVA page settings.');
  if (archive.entries.some((name) => /^word\/(?:footnotes|endnotes|comments)\.xml$/i.test(name))) warnings.add('Footnotes, endnotes, and comments have limited DOCX import compatibility.');
  return {
    document: validateWriterDocument({ content: generateJSON(sanitized.html, writerExtensions), page }),
    warnings: [...warnings].slice(0, 30),
  };
}

export function importPlainText(text: string, page: WriterPageSetup): WriterDocument {
  if (text.length > MAX_TXT_FILE_CHARS) throw new Error('Plain-text imports are limited to 2 million characters.');
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).slice(0, 20_000);
  return validateWriterDocument({
    page,
    content: { type: 'doc', content: lines.map((line) => ({ type: 'paragraph', content: line ? [{ type: 'text', text: line }] : undefined })) },
  });
}
