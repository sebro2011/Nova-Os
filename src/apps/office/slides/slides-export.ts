import PptxGenJS from 'pptxgenjs';
import type { ImageSlideObject, PresentationDocument, SlideObject } from '../core/presentation-model/presentation-model';
import { validatePresentationDocument } from '../core/presentation-model/presentation-model';
import { readRasterInfo } from '../core/file-formats/raster';

const SLIDE_WIDTH_INCHES = 10;
const SLIDE_HEIGHT_INCHES = 5.625;
const MAX_EXPORT_OBJECTS = 2_000;

function color(value: string): string {
  return value.replace('#', '').toUpperCase();
}

function position(object: SlideObject) {
  return {
    x: object.x / 100 * SLIDE_WIDTH_INCHES,
    y: object.y / 100 * SLIDE_HEIGHT_INCHES,
    w: object.width / 100 * SLIDE_WIDTH_INCHES,
    h: object.height / 100 * SLIDE_HEIGHT_INCHES,
    rotate: object.rotation ?? 0,
  };
}

async function compatibleImage(object: ImageSlideObject): Promise<string> {
  const info = readRasterInfo(object.src);
  if (info.mimeType !== 'image/webp') return object.src;
  const image = new Image();
  image.src = object.src;
  try {
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = info.width;
    canvas.height = info.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable.');
    context.drawImage(image, 0, 0);
    return canvas.toDataURL('image/png');
  } catch {
    throw new Error('A WebP image could not be converted for PowerPoint export. Replace it with PNG or JPEG and retry.');
  }
}

export async function exportPresentationPptx(value: PresentationDocument, title: string): Promise<Blob> {
  const document = validatePresentationDocument(value);
  const objectCount = document.slides.reduce((total, slide) => total + slide.objects.length, 0);
  if (objectCount > MAX_EXPORT_OBJECTS) throw new Error('PowerPoint export is limited to 2,000 objects. Split this presentation before exporting.');
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'NOVA Office';
  pptx.company = 'NOVA Web OS';
  pptx.subject = 'Locally exported NOVA Slides presentation';
  pptx.title = title;
  pptx.theme = { headFontFace: 'Arial', bodyFontFace: 'Arial' };
  pptx.defineSlideMaster({
    title: 'NOVA_BLANK',
    background: { color: '0B1020' },
    objects: [],
    slideNumber: { x: 9.45, y: 5.25, color: '94A3B8', fontSize: 8 },
  });

  for (const modelSlide of document.slides) {
    const slide = pptx.addSlide({ masterName: 'NOVA_BLANK' });
    slide.background = { color: color(modelSlide.background) };
    for (const object of modelSlide.objects) {
      if (object.type === 'text') {
        slide.addText(object.text, {
          ...position(object),
          fontFace: 'Arial',
          fontSize: object.fontSize,
          color: color(object.color),
          bold: object.bold,
          align: object.align,
          valign: 'top',
          margin: 0,
          breakLine: false,
          fit: 'shrink',
          wrap: true,
        });
      } else if (object.type === 'shape') {
        slide.addShape(object.shape === 'ellipse' ? pptx.ShapeType.ellipse : pptx.ShapeType.rect, {
          ...position(object),
          fill: { color: color(object.fill) },
          line: { color: color(object.stroke), width: 1 },
        });
      } else {
        const info = readRasterInfo(object.src);
        const bounds = position(object);
        const scale = Math.min(bounds.w / info.width, bounds.h / info.height);
        const width = info.width * scale;
        const height = info.height * scale;
        slide.addImage({
          data: await compatibleImage(object),
          x: bounds.x + (bounds.w - width) / 2,
          y: bounds.y + (bounds.h - height) / 2,
          w: width,
          h: height,
          rotate: bounds.rotate,
          altText: object.alt,
        });
      }
    }
  }

  const output = await pptx.write({ outputType: 'arraybuffer', compression: true });
  if (!(output instanceof ArrayBuffer)) throw new Error('PowerPoint export returned an unsupported output format.');
  return new Blob([output], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
}
