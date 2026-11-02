import { clamp, createId } from '../../../../lib/utils';
import { createSlide, type ImageSlideObject, type PresentationDocument, type PresentationSlide, type ShapeSlideObject, type SlideLayout, type SlideObject, type TextSlideObject } from './presentation-model';

const palettes: Record<PresentationDocument['theme'], { background: string; title: string; body: string }> = {
  cosmic: { background: '#0b1020', title: '#ffffff', body: '#dbe7ff' },
  midnight: { background: '#05070f', title: '#f8fafc', body: '#cbd5e1' },
  light: { background: '#f8fafc', title: '#172033', body: '#475569' },
};

function themedSlide(slide: PresentationSlide, theme: PresentationDocument['theme']): PresentationSlide {
  const palette = palettes[theme];
  return {
    ...slide,
    background: palette.background,
    objects: slide.objects.map((object) => object.type === 'text' ? { ...object, color: object.bold ? palette.title : palette.body } : object),
  };
}

export function applyPresentationTheme(document: PresentationDocument, theme: PresentationDocument['theme']): PresentationDocument {
  return { theme, slides: document.slides.map((slide) => themedSlide(slide, theme)) };
}

export function addPresentationSlide(document: PresentationDocument, layout: SlideLayout = 'title-content'): { document: PresentationDocument; slide: PresentationSlide } {
  if (document.slides.length >= 100) throw new Error('Presentations are limited to 100 slides.');
  const slide = themedSlide(createSlide(`Slide ${document.slides.length + 1}`, layout), document.theme);
  return { document: { ...document, slides: [...document.slides, slide] }, slide };
}

export function duplicatePresentationSlide(document: PresentationDocument, slideId: string): { document: PresentationDocument; slide: PresentationSlide } {
  if (document.slides.length >= 100) throw new Error('Presentations are limited to 100 slides.');
  const index = document.slides.findIndex((slide) => slide.id === slideId);
  if (index < 0) throw new Error('The selected slide no longer exists.');
  const source = document.slides[index];
  const slide: PresentationSlide = {
    ...source,
    id: createId('slide'),
    name: `${source.name} copy`.slice(0, 80),
    objects: source.objects.map((object) => ({ ...object, id: createId('object') })),
  };
  const slides = [...document.slides];
  slides.splice(index + 1, 0, slide);
  return { document: { ...document, slides }, slide };
}

export function deletePresentationSlide(document: PresentationDocument, slideId: string): PresentationDocument {
  if (document.slides.length <= 1) throw new Error('A presentation must contain at least one slide.');
  const slides = document.slides.filter((slide) => slide.id !== slideId);
  if (slides.length === document.slides.length) throw new Error('The selected slide no longer exists.');
  return { ...document, slides };
}

export function movePresentationSlide(document: PresentationDocument, slideId: string, direction: -1 | 1): PresentationDocument {
  const index = document.slides.findIndex((slide) => slide.id === slideId);
  const destination = index + direction;
  if (index < 0 || destination < 0 || destination >= document.slides.length) return document;
  const slides = [...document.slides];
  const [slide] = slides.splice(index, 1);
  slides.splice(destination, 0, slide);
  return { ...document, slides };
}

export function applySlideLayout(slide: PresentationSlide, layout: SlideLayout, theme: PresentationDocument['theme']): PresentationSlide {
  if (layout === 'blank') return { ...slide, layout };
  const template = themedSlide(createSlide(slide.name, layout), theme);
  const slots = template.objects.filter((object): object is TextSlideObject => object.type === 'text');
  const existingText = slide.objects.filter((object): object is TextSlideObject => object.type === 'text');
  const otherObjects = slide.objects.filter((object) => object.type !== 'text');
  const arranged = slots.map((slot, index) => {
    const existing = existingText[index];
    return existing
      ? { ...existing, x: slot.x, y: slot.y, width: slot.width, height: slot.height, fontSize: slot.fontSize, bold: slot.bold, color: slot.color }
      : slot;
  });
  const objects = [...arranged, ...existingText.slice(slots.length), ...otherObjects];
  if (objects.length > 100) throw new Error('This layout needs more text placeholders than can fit on the full slide. Remove an object first.');
  return { ...slide, layout, objects };
}

export function createTextSlideObject(theme: PresentationDocument['theme'] = 'cosmic'): TextSlideObject {
  return { id: createId('object'), type: 'text', text: 'Add your text', x: 12, y: 14, width: 64, height: 20, color: palettes[theme].body, fontSize: 28, bold: false, align: 'left' };
}

export function createShapeSlideObject(shape: ShapeSlideObject['shape'] = 'rectangle'): ShapeSlideObject {
  return { id: createId('object'), type: 'shape', shape, x: 58, y: 42, width: 28, height: 28, fill: '#3b82f6', stroke: '#93c5fd' };
}

export function createImageSlideObject(src: string, alt: string): ImageSlideObject {
  return { id: createId('object'), type: 'image', src, alt: alt.slice(0, 300), x: 20, y: 18, width: 60, height: 60 };
}

export function addSlideObject(slide: PresentationSlide, object: SlideObject): PresentationSlide {
  if (slide.objects.length >= 100) throw new Error('Slides are limited to 100 objects.');
  return { ...slide, objects: [...slide.objects, object] };
}

export function duplicateSlideObject(slide: PresentationSlide, objectId: string): { slide: PresentationSlide; object: SlideObject } {
  if (slide.objects.length >= 100) throw new Error('Slides are limited to 100 objects.');
  const index = slide.objects.findIndex((object) => object.id === objectId);
  if (index < 0) throw new Error('The selected object no longer exists.');
  const source = slide.objects[index];
  const object = { ...source, id: createId('object'), x: clamp(source.x + 3, 0, 100 - source.width), y: clamp(source.y + 3, 0, 100 - source.height) } as SlideObject;
  const objects = [...slide.objects];
  objects.splice(index + 1, 0, object);
  return { slide: { ...slide, objects }, object };
}

export function moveSlideObject(slide: PresentationSlide, objectId: string, direction: -1 | 1): PresentationSlide {
  const index = slide.objects.findIndex((object) => object.id === objectId);
  const destination = index + direction;
  if (index < 0 || destination < 0 || destination >= slide.objects.length) return slide;
  const objects = [...slide.objects];
  const [object] = objects.splice(index, 1);
  objects.splice(destination, 0, object);
  return { ...slide, objects };
}

export function constrainSlideObject<T extends SlideObject>(object: T): T {
  const width = clamp(object.width, 1, 100);
  const height = clamp(object.height, 1, 100);
  const rotation = object.rotation === undefined ? undefined : clamp(object.rotation, -180, 180);
  const constrained = { ...object, width, height, x: clamp(object.x, 0, 100 - width), y: clamp(object.y, 0, 100 - height), ...(rotation === undefined ? {} : { rotation }) } as T;
  return constrained.type === 'text' ? { ...constrained, fontSize: clamp(constrained.fontSize, 8, 120) } : constrained;
}
