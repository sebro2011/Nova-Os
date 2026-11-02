import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';

const MAX_CANVAS_PIXELS = 16_000_000;
const MAX_CANVAS_DIMENSION = 8_192;

export default function PdfPageCanvas({ document, pageNumber, zoom, rotation }: { document: PDFDocumentProxy; pageNumber: number; zoom: number; rotation: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendering, setRendering] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let renderTask: RenderTask | null = null;
    setRendering(true);
    setError('');
    const canvas = canvasRef.current;
    if (!canvas) return () => { active = false; };
    document.getPage(pageNumber).then((page) => {
      if (!active) return;
      const pageRotation = ((page.rotate + rotation) % 360 + 360) % 360;
      const viewport = page.getViewport({ scale: 1.25 * zoom, rotation: pageRotation });
      const basePixels = viewport.width * viewport.height;
      if (!Number.isFinite(basePixels) || basePixels <= 0) throw new Error('This PDF page has invalid dimensions.');
      const budgetScale = Math.sqrt(MAX_CANVAS_PIXELS / basePixels);
      const outputScale = Math.min(window.devicePixelRatio || 1, 2, budgetScale, MAX_CANVAS_DIMENSION / viewport.width, MAX_CANVAS_DIMENSION / viewport.height);
      if (!Number.isFinite(outputScale) || outputScale <= 0) throw new Error('This PDF page is too large to render safely.');
      canvas.width = Math.max(1, Math.floor(viewport.width * outputScale));
      canvas.height = Math.max(1, Math.floor(viewport.height * outputScale));
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('Canvas is unavailable for PDF rendering.');
      renderTask = page.render({
        canvas,
        canvasContext: context,
        viewport,
        transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
        background: '#ffffff',
      });
      return renderTask.promise;
    }).catch((caught: unknown) => {
      if (!active || (caught instanceof Error && caught.name === 'RenderingCancelledException')) return;
      setError(caught instanceof Error ? caught.message : 'This PDF page could not be rendered.');
    }).finally(() => {
      if (active) setRendering(false);
    });
    return () => {
      active = false;
      renderTask?.cancel();
    };
  }, [document, pageNumber, zoom, rotation]);

  return <div className="pdf-page-frame" aria-busy={rendering}>
    <canvas ref={canvasRef} role="img" aria-label={`PDF page ${pageNumber}`} />
    {rendering && !error && <span className="pdf-page-loading" role="status">Rendering page…</span>}
    {error && <p className="pdf-page-error" role="alert">{error}</p>}
  </div>;
}
