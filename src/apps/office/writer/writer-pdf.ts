import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { validateWriterDocument, type WriterDocument } from '../core/document-model/writer-model';
import { sanitizeImportedHtml } from './writer-import';

const PAGE_PIXELS = { A4: { width: 794, height: 1123 }, Letter: { width: 816, height: 1056 } };
const PAGE_POINTS = { A4: { width: 595.28, height: 841.89 }, Letter: { width: 612, height: 792 } };
const MAX_PDF_PAGES = 40;
const MAX_PDF_SOURCE_PIXELS = 50_000_000;

export async function exportWriterPdf(value: WriterDocument, html: string): Promise<Blob> {
  const documentModel = validateWriterDocument(value);
  const page = PAGE_PIXELS[documentModel.page.size];
  const points = PAGE_POINTS[documentModel.page.size];
  const margin = documentModel.page.marginMm / 25.4 * 96;
  const hasHeader = Boolean(documentModel.page.header);
  const hasFooter = Boolean(documentModel.page.footer || documentModel.page.showPageNumbers);
  const contentTop = margin + (hasHeader ? 25 : 0);
  const contentBottom = margin + (hasFooter ? 25 : 0);
  const contentWidth = Math.round(page.width - margin * 2);
  const contentHeight = Math.floor(page.height - contentTop - contentBottom);
  const scale = Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));
  const host = document.createElement('div');
  host.className = 'writer-pdf-source writer-rich-text';
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${contentWidth}px;min-height:1px;background:#fff;color:#172033;z-index:-1;`;
  host.setAttribute('aria-hidden', 'true');
  host.innerHTML = sanitizeImportedHtml(html).html;
  document.body.appendChild(host);
  try {
    const images = [...host.querySelectorAll('img')];
    await Promise.all(images.map(async (image) => {
      if (!image.complete) await image.decode();
    }));
    const sourceHeight = Math.max(1, host.scrollHeight);
    const pageCount = Math.max(1, Math.ceil(sourceHeight / contentHeight));
    if (pageCount > MAX_PDF_PAGES) throw new Error('Raster PDF export is limited to 40 pages. Use DOCX for longer documents or split the file.');
    if (sourceHeight * contentWidth * scale * scale > MAX_PDF_SOURCE_PIXELS) throw new Error('This document is too graphically complex for bounded raster PDF export.');
    const canvas = await html2canvas(host, { backgroundColor: '#ffffff', scale, logging: false, useCORS: false, allowTaint: false, width: contentWidth, height: sourceHeight, windowWidth: contentWidth });
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: [points.width, points.height], compress: true });
    pdf.setProperties({ title: 'NOVA Writer document', creator: 'NOVA Office', subject: 'Locally exported raster PDF' });
    for (let index = 0; index < pageCount; index += 1) {
      if (index > 0) pdf.addPage([points.width, points.height], 'portrait');
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = Math.round(page.width * scale);
      pageCanvas.height = Math.round(page.height * scale);
      const context = pageCanvas.getContext('2d');
      if (!context) throw new Error('Canvas is unavailable for PDF export.');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      const sourceY = Math.round(index * contentHeight * scale);
      const sliceHeight = Math.min(Math.round(contentHeight * scale), canvas.height - sourceY);
      if (sliceHeight > 0) context.drawImage(canvas, 0, sourceY, canvas.width, sliceHeight, Math.round(margin * scale), Math.round(contentTop * scale), canvas.width, sliceHeight);
      context.fillStyle = '#475569';
      context.font = `${10 * scale}px Arial, sans-serif`;
      context.textBaseline = 'middle';
      if (hasHeader) context.fillText(documentModel.page.header, margin * scale, (margin + 3) * scale, contentWidth * scale);
      if (hasFooter) {
        const footer = documentModel.page.showPageNumbers ? `${documentModel.page.footer}${documentModel.page.footer ? ' · ' : ''}${index + 1} / ${pageCount}` : documentModel.page.footer;
        context.fillText(footer, margin * scale, (page.height - margin - 3) * scale, contentWidth * scale);
      }
      pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, points.width, points.height, undefined, 'FAST');
    }
    return pdf.output('blob');
  } finally {
    host.remove();
  }
}
