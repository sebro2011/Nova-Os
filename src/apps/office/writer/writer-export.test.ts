import { describe, expect, it } from 'vitest';
import { exportWriterDocx, writerPlainText } from './writer-export';
import { importDocx } from './writer-import';
import { createWriterDocument, type WriterDocument } from '../core/document-model/writer-model';
import { decodeOoxmlText, extractOoxml } from '../core/file-formats/ooxml';

const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function blobBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

function compatibilityDocument(): WriterDocument {
  return {
    page: { size: 'Letter', marginMm: 18, header: 'NOVA confidential', footer: 'Internal', showPageNumbers: true },
    content: { type: 'doc', content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Quarterly report' }] },
      { type: 'paragraph', content: [
        { type: 'text', text: 'Bold ', marks: [{ type: 'bold' }] },
        { type: 'text', text: 'Example link', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }] },
        { type: 'text', text: ' · ආයුබෝවන් · வணக்கம்' },
      ] },
      { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First item' }] }] }] },
      { type: 'orderedList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Numbered item' }] }] }] },
      { type: 'table', content: [{ type: 'tableRow', content: [
        { type: 'tableHeader', attrs: { colspan: 1, rowspan: 1 }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Metric' }] }] },
        { type: 'tableCell', attrs: { colspan: 1, rowspan: 1 }, content: [{ type: 'paragraph', content: [{ type: 'text', text: '42' }] }] },
      ] }] },
      { type: 'paragraph', content: [{ type: 'image', attrs: { src: tinyPng, alt: 'One pixel fixture' } }] },
    ] },
  };
}

describe('Writer DOCX compatibility', () => {
  it('generates inspectable OOXML and re-imports supported content through Mammoth', async () => {
    const blob = await exportWriterDocx(compatibilityDocument(), 'Compatibility fixture');
    expect(blob.size).toBeGreaterThan(1_000);
    const bytes = await blobBytes(blob);
    const archive = await extractOoxml(bytes, (name) => name === 'word/document.xml' || name === 'word/_rels/document.xml.rels' || /^word\/(?:header|footer)\d+\.xml$/.test(name) || /^word\/media\//.test(name));
    const xml = decodeOoxmlText(archive.files['word/document.xml'], 'word/document.xml');
    const relationships = decodeOoxmlText(archive.files['word/_rels/document.xml.rels'], 'word/_rels/document.xml.rels');
    expect(xml).toContain('Quarterly report');
    expect(xml).toContain('ආයුබෝවන්');
    expect(xml).toContain('வணக்கம்');
    expect(xml).toContain('w:tbl');
    expect(xml).toContain('w:drawing');
    expect(relationships).toContain('https://example.com/');
    expect(relationships).toContain('TargetMode="External"');
    expect(relationships).not.toContain('javascript:');
    expect(Object.keys(archive.files).some((name) => /^word\/media\/.*\.png$/.test(name))).toBe(true);
    const footerName = Object.keys(archive.files).find((name) => /^word\/footer\d+\.xml$/.test(name));
    expect(footerName).toBeDefined();
    expect(decodeOoxmlText(archive.files[footerName!], footerName!)).toContain('PAGE');

    const file = { name: 'roundtrip.docx', size: bytes.length, arrayBuffer: async () => bytes.buffer as ArrayBuffer } as File;
    const imported = await importDocx(file, createWriterDocument().page);
    expect(JSON.stringify(imported.document.content)).toContain('Quarterly report');
    expect(JSON.stringify(imported.document.content)).toContain('First item');
    expect(JSON.stringify(imported.document.content)).toContain('Metric');
    expect(JSON.stringify(imported.document.content)).toContain('data:image/png;base64,');
    expect(imported.warnings.some((warning) => warning.includes('headers and footers'))).toBe(true);
  }, 20_000);

  it('exports plain text without losing Unicode content', () => {
    const text = writerPlainText(compatibilityDocument());
    expect(text).toContain('Quarterly report');
    expect(text).toContain('ආයුබෝවන්');
    expect(text).toContain('வணக்கம்');
    expect(text).toContain('Metric');
  });
});
