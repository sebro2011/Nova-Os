import { validateWriterDocument, type WriterDocument } from '../core/document-model/writer-model';
import { sanitizeImportedHtml } from './writer-import';

export function printWriter(value: WriterDocument, html: string): void {
  const model = validateWriterDocument(value);
  const iframe = document.createElement('iframe');
  iframe.setAttribute('sandbox', 'allow-same-origin allow-modals');
  iframe.setAttribute('title', 'NOVA Writer print preview');
  iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden;pointer-events:none;';
  document.body.appendChild(iframe);
  const printDocument = iframe.contentDocument;
  if (!printDocument) {
    iframe.remove();
    throw new Error('The browser could not create a print preview.');
  }
  printDocument.open();
  printDocument.write('<!doctype html><html><head><title>NOVA Writer</title></head><body></body></html>');
  printDocument.close();
  const style = printDocument.createElement('style');
  style.textContent = `@page{size:${model.page.size};margin:${model.page.marginMm}mm}*{box-sizing:border-box}body{margin:0;color:#172033;font:12pt Arial,sans-serif;line-height:1.55}main{font:inherit}h1,h2,h3,h4,h5,h6{line-height:1.25}table{width:100%;border-collapse:collapse}td,th{border:1px solid #94a3b8;padding:5px}img{max-width:100%;height:auto}a{color:#1d4ed8}.print-header,.print-footer{position:fixed;left:0;right:0;color:#475569;font-size:9pt;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.print-header{top:0}.print-footer{bottom:0}.print-page-number:after{content:counter(page)}@media print{.print-header,.print-footer{display:block}}`;
  printDocument.head.appendChild(style);
  if (model.page.header) {
    const header = printDocument.createElement('header');
    header.className = 'print-header';
    header.textContent = model.page.header;
    printDocument.body.appendChild(header);
  }
  const main = printDocument.createElement('main');
  main.innerHTML = sanitizeImportedHtml(html).html;
  printDocument.body.appendChild(main);
  if (model.page.footer || model.page.showPageNumbers) {
    const footer = printDocument.createElement('footer');
    footer.className = 'print-footer';
    footer.textContent = model.page.footer;
    if (model.page.showPageNumbers) {
      const number = printDocument.createElement('span');
      number.className = 'print-page-number';
      number.setAttribute('aria-label', 'Page number');
      footer.appendChild(number);
    }
    printDocument.body.appendChild(footer);
  }
  let removed = false;
  const cleanup = () => {
    if (removed) return;
    removed = true;
    iframe.remove();
  };
  iframe.contentWindow?.addEventListener('afterprint', cleanup, { once: true });
  window.setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      window.setTimeout(cleanup, 60_000);
    }
  }, 50);
}
