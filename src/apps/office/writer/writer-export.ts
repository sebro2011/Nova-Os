import {
  AlignmentType, BorderStyle, Document, ExternalHyperlink, Footer, Header, HeadingLevel,
  ImageRun, LevelFormat, PageNumber, Packer, Paragraph, Table, TableCell, TableRow,
  TextRun, WidthType, type ParagraphChild,
} from 'docx';
import type { JSONContent } from '@tiptap/core';
import { validateWriterDocument, type WriterDocument } from '../core/document-model/writer-model';
import { readRasterInfo } from '../core/file-formats/raster';

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function webpToPng(dataUrl: string, width: number, height: number): Promise<Uint8Array> {
  const image = new Image();
  image.src = dataUrl;
  try {
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable.');
    context.drawImage(image, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('WebP conversion failed.');
    return new Uint8Array(await blob.arrayBuffer());
  } catch {
    throw new Error('A WebP image could not be converted for DOCX export. Replace it with PNG or JPEG and retry.');
  }
}

async function imageRun(node: JSONContent): Promise<ImageRun> {
  const src = String(node.attrs?.src ?? '');
  const info = readRasterInfo(src);
  const scale = Math.min(1, 600 / info.width, 760 / info.height);
  const isWebp = info.mimeType === 'image/webp';
  return new ImageRun({
    data: isWebp ? await webpToPng(src, info.width, info.height) : info.bytes,
    type: isWebp || info.mimeType === 'image/png' ? 'png' : 'jpg',
    transformation: { width: Math.max(1, Math.round(info.width * scale)), height: Math.max(1, Math.round(info.height * scale)) },
    altText: { name: String(node.attrs?.alt || 'Document image'), description: String(node.attrs?.alt || ''), title: String(node.attrs?.title || '') },
  });
}

function alignment(value: unknown): (typeof AlignmentType)[keyof typeof AlignmentType] | undefined {
  if (value === 'center') return AlignmentType.CENTER;
  if (value === 'right') return AlignmentType.RIGHT;
  if (value === 'justify') return AlignmentType.JUSTIFIED;
  if (value === 'left') return AlignmentType.LEFT;
  return undefined;
}

async function inlineNodes(nodes: JSONContent[] | undefined): Promise<ParagraphChild[]> {
  const output: ParagraphChild[] = [];
  for (const node of nodes ?? []) {
    if (node.type === 'hardBreak') {
      output.push(new TextRun({ break: 1 }));
      continue;
    }
    if (node.type === 'image') {
      output.push(await imageRun(node));
      continue;
    }
    if (node.type !== 'text') continue;
    const marks = node.marks ?? [];
    const style = marks.find((mark) => mark.type === 'textStyle')?.attrs ?? {};
    const link = marks.find((mark) => mark.type === 'link')?.attrs?.href;
    const size = typeof style.fontSize === 'string' ? Math.round(Number.parseFloat(style.fontSize) * 1.5) : undefined;
    const runOptions = {
      text: node.text ?? '',
      bold: marks.some((mark) => mark.type === 'bold'),
      italics: marks.some((mark) => mark.type === 'italic'),
      underline: marks.some((mark) => mark.type === 'underline') ? {} : undefined,
      strike: marks.some((mark) => mark.type === 'strike'),
      color: typeof style.color === 'string' ? style.color.slice(1).toUpperCase() : undefined,
      font: typeof style.fontFamily === 'string' ? style.fontFamily : undefined,
      size,
    };
    output.push(link ? new ExternalHyperlink({ link: String(link), children: [new TextRun({ ...runOptions, style: 'Hyperlink' })] }) : new TextRun(runOptions));
  }
  return output;
}

interface ListContext { kind: 'bullet' | 'ordered'; level: number; instance?: number }

let orderedListInstance = 0;

async function blockNodes(nodes: JSONContent[] | undefined, list?: ListContext): Promise<(Paragraph | Table)[]> {
  const output: (Paragraph | Table)[] = [];
  for (const node of nodes ?? []) {
    if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'blockquote' || node.type === 'codeBlock') {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level ?? 1)));
      const heading = node.type === 'heading' ? [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6][level - 1] : undefined;
      const children = node.type === 'blockquote' || node.type === 'codeBlock' ? await blockNodes(node.content, list) : [];
      if (children.length) {
        output.push(...children);
        continue;
      }
      output.push(new Paragraph({
        children: await inlineNodes(node.content),
        heading,
        alignment: alignment(node.attrs?.textAlign),
        bullet: list?.kind === 'bullet' ? { level: Math.min(8, list.level) } : undefined,
        numbering: list?.kind === 'ordered' ? { reference: 'nova-ordered', level: Math.min(8, list.level), instance: list.instance } : undefined,
        style: node.type === 'codeBlock' ? 'Code' : undefined,
      }));
      continue;
    }
    if (node.type === 'bulletList' || node.type === 'orderedList') {
      const nextList: ListContext = { kind: node.type === 'bulletList' ? 'bullet' : 'ordered', level: list ? Math.min(8, list.level + 1) : 0, instance: node.type === 'orderedList' ? ++orderedListInstance : undefined };
      for (const item of node.content ?? []) output.push(...await blockNodes(item.content, nextList));
      continue;
    }
    if (node.type === 'table') {
      const rows = [] as TableRow[];
      for (const row of node.content ?? []) {
        const cells = [] as TableCell[];
        for (const cell of row.content ?? []) {
          cells.push(new TableCell({
            children: await blockNodes(cell.content),
            columnSpan: Number(cell.attrs?.colspan ?? 1),
            rowSpan: Number(cell.attrs?.rowspan ?? 1),
            margins: { top: 80, bottom: 80, left: 100, right: 100 },
          }));
        }
        rows.push(new TableRow({ children: cells }));
      }
      output.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
      continue;
    }
    if (node.type === 'horizontalRule') output.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'A0A0A0', space: 1 } } }));
  }
  return output;
}

export async function exportWriterDocx(value: WriterDocument, title: string): Promise<Blob> {
  const document = validateWriterDocument(value);
  orderedListInstance = 0;
  const margin = Math.round(document.page.marginMm / 25.4 * 1440);
  const footerChildren: TextRun[] = [];
  if (document.page.footer) footerChildren.push(new TextRun(document.page.footer));
  if (document.page.showPageNumbers) {
    footerChildren.push(new TextRun(document.page.footer ? ' · Page ' : 'Page '));
    footerChildren.push(new TextRun({ children: [PageNumber.CURRENT] }));
  }
  const docx = new Document({
    title,
    creator: 'NOVA Office',
    description: 'Created locally with NOVA Writer.',
    styles: { paragraphStyles: [{ id: 'Code', name: 'Code', basedOn: 'Normal', run: { font: 'Courier New', size: 20 } }] },
    numbering: { config: [{ reference: 'nova-ordered', levels: Array.from({ length: 9 }, (_, level) => ({ level, format: LevelFormat.DECIMAL, text: `%${level + 1}.`, alignment: AlignmentType.START, style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } } })) }] },
    sections: [{
      properties: { page: { size: document.page.size === 'Letter' ? { width: 12240, height: 15840 } : { width: 11906, height: 16838 }, margin: { top: margin, right: margin, bottom: margin, left: margin, header: 720, footer: 720 } } },
      headers: document.page.header ? { default: new Header({ children: [new Paragraph({ children: [new TextRun(document.page.header)], alignment: AlignmentType.CENTER })] }) } : undefined,
      footers: footerChildren.length ? { default: new Footer({ children: [new Paragraph({ children: footerChildren, alignment: AlignmentType.CENTER })] }) } : undefined,
      children: await blockNodes(document.content.content),
    }],
  });
  return Packer.toBlob(docx);
}

export { writerPlainText } from './writer-text';

export function decodeImageForPdf(dataUrl: string): { bytes: Uint8Array; width: number; height: number; format: 'PNG' | 'JPEG' } {
  const info = readRasterInfo(dataUrl);
  if (info.mimeType === 'image/webp') throw new Error('WebP images require conversion before PDF export.');
  return { bytes: dataUrlToBytes(dataUrl), width: info.width, height: info.height, format: info.mimeType === 'image/png' ? 'PNG' : 'JPEG' };
}
