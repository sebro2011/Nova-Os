import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { createPresentationDocument } from '../core/presentation-model/presentation-model';
import { addPresentationSlide, addSlideObject, createShapeSlideObject } from '../core/presentation-model/presentation-operations';
import { exportPresentationPptx } from './slides-export';

async function blobBytes(blob: Blob): Promise<Uint8Array> {
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
  return new Uint8Array(buffer);
}

describe('NOVA Slides PowerPoint export', () => {
  it('writes a real PPTX package with slide text and shapes', async () => {
    const base = createPresentationDocument('pitch');
    if (base.slides[0].objects[0].type === 'text') base.slides[0].objects[0].text = 'NOVA roadmap';
    base.slides[0] = addSlideObject(base.slides[0], createShapeSlideObject('ellipse'));
    const added = addPresentationSlide(base, 'two-column');
    const blob = await exportPresentationPptx(added.document, 'Roadmap');
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.presentationml.presentation');
    const bytes = await blobBytes(blob);
    expect(Array.from(bytes.subarray(0, 2))).toEqual([0x50, 0x4b]);
    const archive = unzipSync(bytes);
    expect(strFromU8(archive['ppt/slides/slide1.xml'])).toContain('NOVA roadmap');
    expect(strFromU8(archive['ppt/slides/slide1.xml'])).toContain('ellipse');
    expect(archive['ppt/slides/slide2.xml']).toBeDefined();
    expect(strFromU8(archive['[Content_Types].xml'])).toContain('presentationml.presentation.main');
  });
});
