import { describe, expect, it } from 'vitest';
import { parseOfficeData, serializeOfficeData } from './native';
import { createWriterDocument } from '../document-model/writer-model';
import { createWorkbookDocument } from '../spreadsheet-model/workbook-model';
import { createPresentationDocument } from '../presentation-model/presentation-model';

 describe('native NOVA Office formats', () => {
  it('round-trips Writer, Sheets, and Slides version 1 models', () => {
    const writer = createWriterDocument('meeting');
    const workbook = createWorkbookDocument('budget');
    const presentation = createPresentationDocument('pitch');
    expect(parseOfficeData('writer', serializeOfficeData('writer', writer))).toEqual(writer);
    expect(parseOfficeData('sheets', serializeOfficeData('sheets', workbook))).toEqual(workbook);
    expect(parseOfficeData('slides', serializeOfficeData('slides', presentation))).toEqual(presentation);
  });

  it('rejects active links, unsupported nodes, and remote images', () => {
    const writer = createWriterDocument();
    writer.content = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'unsafe', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }] };
    expect(() => serializeOfficeData('writer', writer)).not.toThrow();
    expect(() => parseOfficeData('writer', serializeOfficeData('writer', writer))).toThrow('Links allow only safe');
    writer.content = { type: 'doc', content: [{ type: 'script', attrs: {}, content: [] }] };
    expect(() => parseOfficeData('writer', serializeOfficeData('writer', writer))).toThrow('Unsupported Writer node');
    writer.content = { type: 'doc', content: [{ type: 'image', attrs: { src: 'https://tracker.example/pixel' } }] };
    expect(() => parseOfficeData('writer', serializeOfficeData('writer', writer))).toThrow('raster data URL');
  });

  it('rejects out-of-range cells and slide objects', () => {
    const workbook = createWorkbookDocument();
    workbook.sheets[0].cells.A501 = { value: 'outside' };
    expect(() => parseOfficeData('sheets', serializeOfficeData('sheets', workbook))).toThrow('outside the supported grid');
    const presentation = createPresentationDocument();
    presentation.slides[0].objects[0].x = 95;
    expect(() => parseOfficeData('slides', serializeOfficeData('slides', presentation))).toThrow('inside the slide');
  });
});
