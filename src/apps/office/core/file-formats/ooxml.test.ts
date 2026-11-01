import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { decodeOoxmlText, extractOoxml, hasOoxmlMacro } from './ooxml';

describe('bounded OOXML extraction', () => {
  it('extracts only requested content and reports macro-related entries', async () => {
    const archive = zipSync({
      'word/document.xml': strToU8('<document>Hello</document>'),
      'word/vbaProject.bin': strToU8('not executed'),
      'word/embeddings/object.bin': strToU8('not extracted'),
    });
    const result = await extractOoxml(archive, (name) => name === 'word/document.xml');
    expect(decodeOoxmlText(result.files['word/document.xml'], 'word/document.xml')).toBe('<document>Hello</document>');
    expect(result.files['word/vbaProject.bin']).toBeUndefined();
    expect(hasOoxmlMacro(result.entries)).toBe(true);
  });

  it('rejects actual streamed output that exceeds the budget', async () => {
    const archive = zipSync({ 'word/document.xml': strToU8('x'.repeat(4096)) });
    // Forge only the local uncompressed-size field; streamed output must still be capped.
    new DataView(archive.buffer, archive.byteOffset, archive.byteLength).setUint32(22, 1, true);
    await expect(extractOoxml(archive, () => true, { maxEntryBytes: 32, maxTotalBytes: 32 })).rejects.toThrow('safe import budget');
  });

  it('rejects excessive entry counts and invalid archives', async () => {
    const archive = zipSync({ 'one.txt': strToU8('1'), 'two.txt': strToU8('2') });
    await expect(extractOoxml(archive, () => false, { maxEntries: 1 })).rejects.toThrow('too many');
    await expect(extractOoxml(strToU8('not a zip'), () => true)).rejects.toThrow();
  });
});
