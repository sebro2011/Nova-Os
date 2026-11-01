import { createId } from '../../../../lib/utils';
import { officeArray, officeColor, officeId, officeImage, officeNumber, officeRecord, officeText } from '../file-formats/validation';

interface SlideObjectBase {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

export interface TextSlideObject extends SlideObjectBase {
  type: 'text';
  text: string;
  color: string;
  fontSize: number;
  bold: boolean;
  align: 'left' | 'center' | 'right';
}

export interface ImageSlideObject extends SlideObjectBase {
  type: 'image';
  src: string;
  alt: string;
}

export interface ShapeSlideObject extends SlideObjectBase {
  type: 'shape';
  shape: 'rectangle' | 'ellipse';
  fill: string;
  stroke: string;
}

export type SlideObject = TextSlideObject | ImageSlideObject | ShapeSlideObject;
export type SlideLayout = 'blank' | 'title' | 'title-content' | 'two-column';

export interface PresentationSlide {
  id: string;
  name: string;
  background: string;
  layout: SlideLayout;
  objects: SlideObject[];
}

export interface PresentationDocument {
  theme: 'cosmic' | 'light' | 'midnight';
  slides: PresentationSlide[];
}

function validateBase(input: Record<string, unknown>): SlideObjectBase {
  const base: SlideObjectBase = {
    id: officeId(input.id, 'Slide object ID'),
    x: officeNumber(input.x, 'Object X', 0, 99),
    y: officeNumber(input.y, 'Object Y', 0, 99),
    width: officeNumber(input.width, 'Object width', 1, 100),
    height: officeNumber(input.height, 'Object height', 1, 100),
  };
  if (base.x + base.width > 100 || base.y + base.height > 100) throw new Error('Slide objects must remain inside the slide.');
  if (input.rotation !== undefined) base.rotation = officeNumber(input.rotation, 'Object rotation', -180, 180);
  return base;
}

function validateObject(value: unknown): SlideObject {
  const input = officeRecord(value, 'Slide object');
  const base = validateBase(input);
  if (input.type === 'text') {
    const align = input.align ?? 'left';
    if (!['left', 'center', 'right'].includes(String(align))) throw new Error('Invalid slide text alignment.');
    return { ...base, type: 'text', text: officeText(input.text, 'Slide text', 50_000), color: officeColor(input.color ?? '#ffffff'), fontSize: officeNumber(input.fontSize ?? 24, 'Slide font size', 8, 120), bold: input.bold === true, align: align as TextSlideObject['align'] };
  }
  if (input.type === 'image') return { ...base, type: 'image', src: officeImage(input.src), alt: officeText(input.alt ?? '', 'Slide image alternative text', 300) };
  if (input.type === 'shape') {
    if (!['rectangle', 'ellipse'].includes(String(input.shape))) throw new Error('Unsupported slide shape.');
    return { ...base, type: 'shape', shape: input.shape as ShapeSlideObject['shape'], fill: officeColor(input.fill ?? '#3b82f6'), stroke: officeColor(input.stroke ?? '#93c5fd') };
  }
  throw new Error('Unsupported slide object type.');
}

export function validatePresentationDocument(value: unknown): PresentationDocument {
  const input = officeRecord(value, 'Presentation');
  const theme = ['cosmic', 'light', 'midnight'].includes(String(input.theme)) ? input.theme as PresentationDocument['theme'] : 'cosmic';
  const slideIds = new Set<string>();
  const slides = officeArray(input.slides, 'Presentation slides', 100).map((item, index): PresentationSlide => {
    const slide = officeRecord(item, `Slide ${index + 1}`);
    const id = officeId(slide.id, `Slide ${index + 1} ID`);
    if (slideIds.has(id)) throw new Error('Presentation contains duplicate slide IDs.');
    slideIds.add(id);
    const layout = ['blank', 'title', 'title-content', 'two-column'].includes(String(slide.layout)) ? slide.layout as SlideLayout : 'blank';
    const objects = officeArray(slide.objects ?? [], `Slide ${index + 1} objects`, 100).map(validateObject);
    const objectIds = new Set<string>();
    objects.forEach((object) => {
      if (objectIds.has(object.id)) throw new Error(`Slide ${index + 1} contains duplicate object IDs.`);
      objectIds.add(object.id);
    });
    return { id, name: officeText(slide.name ?? `Slide ${index + 1}`, `Slide ${index + 1} name`, 80, false), background: officeColor(slide.background ?? '#0b1020'), layout, objects };
  });
  if (!slides.length) throw new Error('A presentation must contain at least one slide.');
  return { theme, slides };
}

export function createSlide(name = 'Slide 1', layout: SlideLayout = 'title-content'): PresentationSlide {
  const slide: PresentationSlide = { id: createId('slide'), name, background: '#0b1020', layout, objects: [] };
  if (layout !== 'blank') {
    slide.objects.push({ id: createId('object'), type: 'text', text: 'Presentation title', x: 8, y: 10, width: 84, height: 16, color: '#ffffff', fontSize: 36, bold: true, align: 'left' });
  }
  if (layout === 'title-content' || layout === 'two-column') {
    slide.objects.push({ id: createId('object'), type: 'text', text: 'Add your content', x: 10, y: 36, width: layout === 'two-column' ? 38 : 80, height: 42, color: '#dbe7ff', fontSize: 22, bold: false, align: 'left' });
  }
  if (layout === 'two-column') slide.objects.push({ id: createId('object'), type: 'text', text: 'Second column', x: 54, y: 36, width: 36, height: 42, color: '#dbe7ff', fontSize: 22, bold: false, align: 'left' });
  return slide;
}

export function createPresentationDocument(template: 'blank' | 'pitch' = 'blank'): PresentationDocument {
  const slide = createSlide('Slide 1', template === 'pitch' ? 'title' : 'title-content');
  if (template === 'pitch') slide.objects.push({ id: createId('object'), type: 'text', text: 'Your Productivity. Your Workspace.', x: 8, y: 36, width: 70, height: 14, color: '#93c5fd', fontSize: 22, bold: false, align: 'left' });
  return { theme: 'cosmic', slides: [slide] };
}
