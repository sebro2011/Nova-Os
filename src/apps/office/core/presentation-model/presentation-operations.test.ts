import { describe, expect, it } from 'vitest';
import { createPresentationDocument, validatePresentationDocument } from './presentation-model';
import { addPresentationSlide, applyPresentationTheme, applySlideLayout, constrainSlideObject, createShapeSlideObject, deletePresentationSlide, duplicatePresentationSlide, movePresentationSlide } from './presentation-operations';

describe('presentation operations', () => {
  it('adds, duplicates with fresh IDs, reorders, and deletes slides', () => {
    const original = createPresentationDocument('pitch');
    const added = addPresentationSlide(original, 'two-column');
    expect(added.document.slides).toHaveLength(2);
    const duplicated = duplicatePresentationSlide(added.document, added.slide.id);
    expect(duplicated.document.slides).toHaveLength(3);
    expect(duplicated.slide.id).not.toBe(added.slide.id);
    expect(duplicated.slide.objects.map((object) => object.id)).not.toEqual(added.slide.objects.map((object) => object.id));
    const moved = movePresentationSlide(duplicated.document, duplicated.slide.id, -1);
    expect(moved.slides[1].id).toBe(duplicated.slide.id);
    const deleted = deletePresentationSlide(moved, duplicated.slide.id);
    expect(deleted.slides).toHaveLength(2);
    expect(validatePresentationDocument(deleted)).toEqual(deleted);
  });

  it('changes layouts without discarding existing text and applies a complete theme', () => {
    const document = createPresentationDocument();
    document.slides[0].objects[0].type === 'text' && (document.slides[0].objects[0].text = 'NOVA roadmap');
    const arranged = applySlideLayout(document.slides[0], 'two-column', 'light');
    expect(arranged.layout).toBe('two-column');
    expect(arranged.objects.filter((object) => object.type === 'text')[0]).toMatchObject({ text: 'NOVA roadmap', width: 84 });
    const themed = applyPresentationTheme({ ...document, slides: [arranged] }, 'light');
    expect(themed.slides[0].background).toBe('#f8fafc');
    expect(themed.slides[0].objects.every((object) => object.type !== 'text' || object.color !== '#ffffff')).toBe(true);
    expect(() => validatePresentationDocument(themed)).not.toThrow();
  });

  it('refuses a layout that would truncate objects from a full slide', () => {
    const document = createPresentationDocument();
    const slide = document.slides[0];
    const shape = createShapeSlideObject();
    slide.objects = Array.from({ length: 100 }, (_, index) => ({ ...shape, id: `object-${index}` }));
    expect(() => applySlideLayout(slide, 'two-column', 'cosmic')).toThrow('full slide');
    expect(slide.objects).toHaveLength(100);
  });

  it('clamps geometry, rotation, and font size to the native model contract', () => {
    const document = createPresentationDocument();
    const object = document.slides[0].objects[0];
    const constrained = constrainSlideObject({ ...object, x: 95, y: -4, width: 20, height: 110, rotation: 240 });
    expect(constrained).toMatchObject({ x: 80, y: 0, width: 20, height: 100, rotation: 180 });
    if (constrained.type === 'text') {
      const sized = constrainSlideObject({ ...constrained, fontSize: 500 });
      expect(sized.fontSize).toBe(120);
    }
  });
});
