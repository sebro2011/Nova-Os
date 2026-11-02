import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight, Download, Maximize2, Minimize2, RotateCw, Search, X, ZoomIn, ZoomOut } from 'lucide-react';
import { getDocument, GlobalWorkerOptions, type PDFDocumentLoadingTask, type PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import type { FileNode } from '../../../types';
import { useI18n } from '../../../context/LocalizationContext';
import { errorMessage } from '../../../lib/utils';
import { OfficeToolbarButton } from '../components/OfficeUI';
import { pdfDataUrlToBytes } from '../core/file-formats/pdf';
import { downloadBlob } from '../services/download';
import PdfPageCanvas from './PdfPageCanvas';
import { findPdfPageMatches, pdfTextContentToString, type PdfSearchMatch } from './pdf-search';

GlobalWorkerOptions.workerSrc = workerUrl;

const MAX_PDF_PAGES = 500;
const MAX_SEARCH_RESULTS = 100;

export default function PdfViewer({ file }: { file: FileNode }) {
  const { t } = useI18n();
  const viewerRef = useRef<HTMLDivElement>(null);
  const searchGenerationRef = useRef(0);
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<PdfSearchMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchComplete, setSearchComplete] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    let active = true;
    let task: PDFDocumentLoadingTask | null = null;
    setLoading(true);
    setProgress(0);
    setError('');
    setPdfDocument(null);
    setPageNumber(1);
    setMatches([]);
    setSearchComplete(false);
    searchGenerationRef.current += 1;
    const load = async () => {
      try {
        const bytes = pdfDataUrlToBytes(file.content);
        task = getDocument({
          data: bytes,
          disableAutoFetch: true,
          disableStream: true,
          useSystemFonts: true,
          maxImageSize: 16_000_000,
        });
        task.onProgress = ({ loaded, total }: { loaded: number; total: number }) => {
          if (active && total > 0) setProgress(Math.min(100, Math.round(loaded / total * 100)));
        };
        const document = await task.promise;
        if (document.numPages > MAX_PDF_PAGES) {
          await task.destroy();
          throw new Error('NOVA PDF supports up to 500 pages per document. Split this PDF before opening it.');
        }
        if (!active) {
          await task.destroy();
          return;
        }
        setPdfDocument(document);
      } catch (caught) {
        if (active) setError(errorMessage(caught));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
      searchGenerationRef.current += 1;
      if (task) void task.destroy();
    };
  }, [file.id, file.content]);

  useEffect(() => {
    const changed = () => setFullscreen(document.fullscreenElement === viewerRef.current);
    document.addEventListener('fullscreenchange', changed);
    return () => document.removeEventListener('fullscreenchange', changed);
  }, []);

  const goToPage = (page: number) => {
    if (!pdfDocument) return;
    setPageNumber(Math.max(1, Math.min(pdfDocument.numPages, Math.round(page))));
  };
  const download = () => {
    try {
      const bytes = pdfDataUrlToBytes(file.content);
      const copy = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(copy).set(bytes);
      downloadBlob(new Blob([copy], { type: 'application/pdf' }), file.name);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (viewerRef.current?.requestFullscreen) await viewerRef.current.requestFullscreen();
      else throw new Error('Fullscreen is not supported by this browser.');
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };
  const search = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!pdfDocument || !query.trim()) { setMatches([]); setSearchComplete(false); return; }
    const generation = ++searchGenerationRef.current;
    setSearching(true);
    setSearchComplete(false);
    setMatches([]);
    setError('');
    try {
      const found: PdfSearchMatch[] = [];
      for (let page = 1; page <= pdfDocument.numPages && found.length < MAX_SEARCH_RESULTS; page += 1) {
        if (generation !== searchGenerationRef.current) return;
        const pdfPage = await pdfDocument.getPage(page);
        const content = await pdfPage.getTextContent();
        const text = pdfTextContentToString(content.items);
        found.push(...findPdfPageMatches(page, text, query, MAX_SEARCH_RESULTS - found.length));
      }
      if (generation === searchGenerationRef.current) {
        setMatches(found);
        setSearchComplete(true);
      }
    } catch (caught) {
      if (generation === searchGenerationRef.current) setError(errorMessage(caught));
    } finally {
      if (generation === searchGenerationRef.current) setSearching(false);
    }
  };
  const keyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
      event.preventDefault();
      setSearchOpen(true);
    } else if (event.key === 'ArrowRight' || event.key === 'PageDown') { event.preventDefault(); goToPage(pageNumber + 1); }
    else if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); goToPage(pageNumber - 1); }
    else if (event.key === '+' || event.key === '=') { event.preventDefault(); setZoom((current) => Math.min(3, current + 0.25)); }
    else if (event.key === '-') { event.preventDefault(); setZoom((current) => Math.max(0.5, current - 0.25)); }
  };

  return <div ref={viewerRef} className="pdf-viewer" tabIndex={-1} onKeyDown={keyboard}>
    <div className="office-toolbar pdf-toolbar" role="toolbar" aria-label="PDF tools">
      <OfficeToolbarButton label={t('common.previous')} onClick={() => goToPage(pageNumber - 1)} disabled={!pdfDocument || pageNumber <= 1}><ChevronLeft size={16} /></OfficeToolbarButton>
      <label className="pdf-page-control"><span className="sr-only">{t('pdf.page')}</span><input aria-label={t('pdf.page')} type="number" min={1} max={pdfDocument?.numPages ?? 1} value={pageNumber} disabled={!pdfDocument} onChange={(event) => goToPage(Number(event.target.value))} /><span>/ {pdfDocument?.numPages ?? '—'}</span></label>
      <OfficeToolbarButton label={t('common.next')} onClick={() => goToPage(pageNumber + 1)} disabled={!pdfDocument || pageNumber >= pdfDocument.numPages}><ChevronRight size={16} /></OfficeToolbarButton>
      <span className="office-toolbar-divider" />
      <OfficeToolbarButton label={t('pdf.zoomOut')} onClick={() => setZoom((current) => Math.max(0.5, current - 0.25))} disabled={!pdfDocument || zoom <= 0.5}><ZoomOut size={16} /></OfficeToolbarButton>
      <span className="pdf-zoom-label">{Math.round(zoom * 100)}%</span>
      <OfficeToolbarButton label={t('pdf.zoomIn')} onClick={() => setZoom((current) => Math.min(3, current + 0.25))} disabled={!pdfDocument || zoom >= 3}><ZoomIn size={16} /></OfficeToolbarButton>
      <OfficeToolbarButton label="Rotate clockwise" onClick={() => setRotation((current) => (current + 90) % 360)} disabled={!pdfDocument}><RotateCw size={16} /></OfficeToolbarButton>
      <span className="office-toolbar-divider" />
      <OfficeToolbarButton label={t('pdf.searchDocument')} active={searchOpen} onClick={() => setSearchOpen((current) => !current)} disabled={!pdfDocument}><Search size={16} /></OfficeToolbarButton>
      <OfficeToolbarButton label={t('common.download')} onClick={download}><Download size={16} /></OfficeToolbarButton>
      <OfficeToolbarButton label={fullscreen ? t('slides.exitPresentation') : t('pdf.fullscreen')} onClick={() => void toggleFullscreen()} disabled={!pdfDocument}>{fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</OfficeToolbarButton>
    </div>
    {searchOpen && <div className="pdf-search-panel">
      <form onSubmit={(event) => void search(event)}>
        <Search size={14} /><input autoFocus aria-label={t('pdf.searchDocument')} value={query} maxLength={200} placeholder={t('pdf.searchDocument')} onChange={(event) => { setQuery(event.target.value); setSearchComplete(false); }} />
        <button type="submit" className="office-secondary-button" disabled={searching || !query.trim()}>{searching ? t('common.loading') : t('common.search')}</button>
        <OfficeToolbarButton label={t('common.close')} onClick={() => { searchGenerationRef.current += 1; setSearching(false); setSearchOpen(false); }}><X size={14} /></OfficeToolbarButton>
      </form>
      {(searching || searchComplete) && <div className="pdf-search-results app-scroll" aria-live="polite">
        {searching && <p role="status">Searching up to {pdfDocument?.numPages ?? 0} pages…</p>}
        {searchComplete && !matches.length && <p>{t('pdf.noMatches')}</p>}
        {matches.map((match, index) => <button type="button" key={`${match.pageNumber}-${index}`} onClick={() => goToPage(match.pageNumber)}><strong>{t('pdf.page')} {match.pageNumber}</strong><span>{match.excerpt}</span></button>)}
        {matches.length === MAX_SEARCH_RESULTS && <p>Showing the first {MAX_SEARCH_RESULTS} matches.</p>}
      </div>}
    </div>}
    {error && <div className="office-action-banner is-error" role="alert">{error}</div>}
    <main className="pdf-canvas app-scroll">
      {loading && <div className="office-centered-state" role="status"><p>{t('common.loading')} {progress > 0 && progress < 100 ? `${progress}%` : ''}</p></div>}
      {!loading && pdfDocument && <PdfPageCanvas document={pdfDocument} pageNumber={pageNumber} zoom={zoom} rotation={rotation} />}
    </main>
    <footer className="office-statusbar"><span>{pdfDocument ? t('pdf.pageOf', { page: pageNumber, total: pdfDocument.numPages }) : t('pdf.document')}</span><span className="office-statusbar-right">{t('office.localOffline')}</span></footer>
  </div>;
}
