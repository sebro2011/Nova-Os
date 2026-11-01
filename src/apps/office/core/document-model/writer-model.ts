import type { JSONContent } from '@tiptap/core';
import { officeArray, officeColor, officeImage, officeLink, officeNumber, officeRecord, officeText } from '../file-formats/validation';

export interface WriterPageSetup {
  size: 'A4' | 'Letter';
  marginMm: number;
  header: string;
  footer: string;
  showPageNumbers: boolean;
}

export interface WriterDocument {
  content: JSONContent;
  page: WriterPageSetup;
}

const nodeTypes = new Set(['doc', 'paragraph', 'text', 'heading', 'bulletList', 'orderedList', 'listItem', 'table', 'tableRow', 'tableCell', 'tableHeader', 'image', 'horizontalRule', 'blockquote', 'codeBlock', 'hardBreak']);
const markTypes = new Set(['bold', 'italic', 'underline', 'strike', 'link', 'textStyle']);
const alignments = new Set(['left', 'center', 'right', 'justify']);

function textAlign(value: unknown): string | undefined {
  return typeof value === 'string' && alignments.has(value) ? value : undefined;
}

function sanitizeMarks(value: unknown): JSONContent['marks'] {
  if (value === undefined) return undefined;
  return officeArray(value, 'Text marks', 8).map((item): NonNullable<JSONContent['marks']>[number] => {
    const mark = officeRecord(item, 'Text mark');
    const type = officeText(mark.type, 'Mark type', 20, false);
    if (!markTypes.has(type)) throw new Error(`Unsupported Writer mark: ${type}`);
    if (type === 'link') {
      const attrs = officeRecord(mark.attrs ?? {}, 'Link');
      return { type, attrs: { href: officeLink(attrs.href), target: '_blank', rel: 'noopener noreferrer nofollow' } };
    }
    if (type === 'textStyle') {
      const attrs = officeRecord(mark.attrs ?? {}, 'Text style');
      const style: Record<string, string> = {};
      if (attrs.color !== undefined && attrs.color !== null) style.color = officeColor(attrs.color);
      if (attrs.fontFamily !== undefined && attrs.fontFamily !== null) {
        const fontFamily = officeText(attrs.fontFamily, 'Font family', 80, false);
        if (!/^[\w\s,"'-]+$/.test(fontFamily)) throw new Error('Font family contains unsupported characters.');
        style.fontFamily = fontFamily;
      }
      if (attrs.fontSize !== undefined && attrs.fontSize !== null) {
        const fontSize = officeText(attrs.fontSize, 'Font size', 8, false);
        const size = Number.parseFloat(fontSize);
        if (!/^\d{1,2}(?:\.\d)?px$/.test(fontSize) || size < 8 || size > 96) throw new Error('Font size must be between 8 and 96 px.');
        style.fontSize = fontSize;
      }
      return Object.keys(style).length ? { type, attrs: style } : { type };
    }
    return { type };
  });
}

interface Budget { nodes: number; characters: number }

function sanitizeNode(value: unknown, depth: number, budget: Budget): JSONContent {
  if (depth > 24) throw new Error('Writer content is nested too deeply.');
  budget.nodes += 1;
  if (budget.nodes > 50_000) throw new Error('Writer documents are limited to 50,000 structured nodes.');
  const input = officeRecord(value, 'Writer node');
  const type = officeText(input.type, 'Writer node type', 30, false);
  if (!nodeTypes.has(type)) throw new Error(`Unsupported Writer node: ${type}`);
  const output: JSONContent = { type };

  if (type === 'text') {
    const text = officeText(input.text, 'Writer text', 200_000);
    budget.characters += text.length;
    if (budget.characters > 2_000_000) throw new Error('Writer documents are limited to 2 million text characters.');
    output.text = text;
    const marks = sanitizeMarks(input.marks);
    if (marks) output.marks = marks;
    return output;
  }

  const attrs = officeRecord(input.attrs ?? {}, `${type} attributes`);
  const nextAttrs: Record<string, unknown> = {};
  if (type === 'heading') nextAttrs.level = officeNumber(attrs.level ?? 1, 'Heading level', 1, 6);
  if (type === 'paragraph' || type === 'heading') {
    const align = textAlign(attrs.textAlign);
    if (align) nextAttrs.textAlign = align;
  }
  if (type === 'orderedList' && attrs.start !== undefined) nextAttrs.start = officeNumber(attrs.start, 'List start', 1, 9999);
  if (type === 'codeBlock' && attrs.language) nextAttrs.language = officeText(attrs.language, 'Code language', 40);
  if (type === 'tableCell' || type === 'tableHeader') {
    nextAttrs.colspan = officeNumber(attrs.colspan ?? 1, 'Column span', 1, 50);
    nextAttrs.rowspan = officeNumber(attrs.rowspan ?? 1, 'Row span', 1, 100);
    if (Array.isArray(attrs.colwidth)) nextAttrs.colwidth = attrs.colwidth.slice(0, 50).map((width) => width === null ? null : officeNumber(width, 'Column width', 20, 2000));
  }
  if (type === 'image') {
    nextAttrs.src = officeImage(attrs.src);
    if (attrs.alt) nextAttrs.alt = officeText(attrs.alt, 'Image alternative text', 300);
    if (attrs.title) nextAttrs.title = officeText(attrs.title, 'Image title', 300);
  }
  if (Object.keys(nextAttrs).length) output.attrs = nextAttrs;

  if (input.content !== undefined) {
    if (type === 'image' || type === 'horizontalRule' || type === 'hardBreak') throw new Error(`${type} cannot contain child nodes.`);
    output.content = officeArray(input.content, `${type} content`, 20_000).map((child) => sanitizeNode(child, depth + 1, budget));
  } else if (type === 'doc') {
    throw new Error('Writer document content is required.');
  }
  return output;
}

export function validateWriterDocument(value: unknown): WriterDocument {
  const input = officeRecord(value, 'Writer document');
  const pageInput = officeRecord(input.page ?? {}, 'Page setup');
  return {
    content: sanitizeNode(input.content, 0, { nodes: 0, characters: 0 }),
    page: {
      size: pageInput.size === 'Letter' ? 'Letter' : 'A4',
      marginMm: officeNumber(pageInput.marginMm ?? 20, 'Page margin', 8, 40),
      header: officeText(pageInput.header ?? '', 'Page header', 2_000),
      footer: officeText(pageInput.footer ?? '', 'Page footer', 2_000),
      showPageNumbers: pageInput.showPageNumbers !== false,
    },
  };
}

export function createWriterDocument(template: 'blank' | 'meeting' | 'letter' | 'report' = 'blank'): WriterDocument {
  const paragraphs: JSONContent[] = template === 'meeting'
    ? [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Meeting notes' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Date · Attendees' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Agenda' }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First topic' }] }] }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Actions' }] },
        { type: 'paragraph' },
      ]
    : template === 'letter'
      ? [{ type: 'paragraph', content: [{ type: 'text', text: 'Dear reader,' }] }, { type: 'paragraph' }, { type: 'paragraph', content: [{ type: 'text', text: 'Write your message here.' }] }, { type: 'paragraph' }, { type: 'paragraph', content: [{ type: 'text', text: 'Sincerely,' }] }]
      : template === 'report'
        ? [{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Project report' }] }, { type: 'paragraph', content: [{ type: 'text', text: 'Executive summary' }] }, { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Findings' }] }, { type: 'paragraph' }]
        : [{ type: 'paragraph' }];
  return {
    content: { type: 'doc', content: paragraphs },
    page: { size: 'A4', marginMm: 20, header: '', footer: '', showPageNumbers: true },
  };
}
