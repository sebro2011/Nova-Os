import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { FileType2, FolderOpen, LayoutGrid, Upload } from 'lucide-react';
import { useLauncher } from '../../../context/LaunchContext';
import { useI18n } from '../../../context/LocalizationContext';
import { usePreferences } from '../../../context/PreferencesContext';
import { getRecord } from '../../../lib/db';
import { errorMessage } from '../../../lib/utils';
import type { FileNode } from '../../../types';
import { OfficeLoading } from '../components/OfficeUI';
import { MAX_PDF_BYTES, OFFICE_MIME } from '../core/file-formats/constants';
import { validatePdfBytes, validatePdfDataUrl } from '../core/file-formats/pdf';
import { createPdfFile } from '../services/office-storage';
import '../office.css';
import './pdf.css';

const PdfViewer = lazy(() => import('./PdfViewer'));

export default function PdfApp() {
  const { t } = useI18n();
  const { consumeLaunchIntent, openApp } = useLauncher();
  const { preferences, updatePreferences } = usePreferences();
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;
  const inputRef = useRef<HTMLInputElement>(null);
  const operationRef = useRef(0);
  const [file, setFile] = useState<FileNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const markRecent = useCallback((id: string) => {
    updatePreferences({ recentOfficeFiles: [id, ...preferencesRef.current.recentOfficeFiles.filter((item) => item !== id)].slice(0, 50) });
  }, [updatePreferences]);
  const showFile = useCallback((next: FileNode) => {
    setFile(next);
    setError('');
    setLoading(false);
    markRecent(next.id);
  }, [markRecent]);
  const openRecord = useCallback(async (id: string) => {
    const operation = ++operationRef.current;
    setLoading(true);
    setError('');
    try {
      const record = await getRecord<FileNode>('files', id);
      if (!record || record.kind !== 'file' || record.mimeType !== OFFICE_MIME.pdf) throw new Error('The requested PDF no longer exists or has a different format.');
      if (record.trashed) throw new Error('Restore this PDF from Trash before opening it.');
      validatePdfDataUrl(record.content);
      if (operation === operationRef.current) showFile(record);
    } catch (caught) {
      if (operation === operationRef.current) { setFile(null); setError(errorMessage(caught)); setLoading(false); }
    }
  }, [showFile]);

  useEffect(() => {
    const intent = consumeLaunchIntent('pdf');
    if (intent?.recordId) void openRecord(intent.recordId);
  }, [consumeLaunchIntent, openRecord]);

  const importPdf = async (selected?: File) => {
    if (!selected) return;
    const operation = ++operationRef.current;
    setLoading(true);
    setError('');
    try {
      if (selected.size > MAX_PDF_BYTES) throw new Error('PDF imports are limited to 20 MB.');
      if (selected.type && selected.type !== 'application/pdf' && !selected.name.toLowerCase().endsWith('.pdf')) throw new Error('Choose a PDF document.');
      const bytes = validatePdfBytes(new Uint8Array(await selected.arrayBuffer()));
      const created = await createPdfFile(selected.name, bytes, undefined, true);
      if (operation === operationRef.current) showFile(created);
    } catch (caught) {
      if (operation === operationRef.current) { setError(errorMessage(caught)); setLoading(false); }
    }
  };

  return <div className="office-app pdf-app">
    <header className="office-app-header">
      <FileType2 size={18} className="accent-text" />
      <span className="pdf-file-title" title={file?.name}>{file?.name ?? 'NOVA PDF'}</span>
      <button type="button" className="office-secondary-button" onClick={() => inputRef.current?.click()}><Upload size={14} />{t('office.openPdf')}</button>
    </header>
    {loading ? <OfficeLoading label={t('common.loading')} /> : file ? <Suspense fallback={<OfficeLoading label={t('common.loading')} />}><PdfViewer key={file.id} file={file} /></Suspense> : <main className="pdf-welcome app-scroll">
      <section>
        <span className="pdf-welcome-icon"><FileType2 size={34} /></span>
        <p className="eyebrow">NOVA OFFICE</p>
        <h1>NOVA PDF</h1>
        <p>Open, search, rotate, and read local PDF documents. Files stay in this browser’s virtual file system.</p>
        {error && <p className="pdf-welcome-error" role="alert">{error}</p>}
        <div className="pdf-welcome-actions">
          <button type="button" className="office-primary-button" onClick={() => inputRef.current?.click()}><Upload size={15} />{t('office.openPdf')}</button>
          <button type="button" className="office-secondary-button" onClick={() => openApp('files')}><FolderOpen size={15} />Browse Files</button>
          <button type="button" className="office-secondary-button" onClick={() => openApp('office')}><LayoutGrid size={15} />{t('office.hub')}</button>
        </div>
        <small>Viewer only · PDF editing and password-protected documents are not supported.</small>
      </section>
    </main>}
    <input ref={inputRef} className="hidden" type="file" accept="application/pdf,.pdf" onChange={(event) => { void importPdf(event.target.files?.[0]); event.target.value = ''; }} />
  </div>;
}
