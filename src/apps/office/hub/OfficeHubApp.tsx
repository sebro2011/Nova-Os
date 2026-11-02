import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Clock3, FileText, FileType2, FolderOpen, LayoutGrid, Plus, Presentation, Search, Sheet } from 'lucide-react';
import { useLauncher } from '../../../context/LaunchContext';
import { useI18n } from '../../../context/LocalizationContext';
import { usePreferences } from '../../../context/PreferencesContext';
import { errorMessage } from '../../../lib/utils';
import type { AppId, FileNode } from '../../../types';
import { officeKindFromMime, type OfficeDocumentKind, type OfficeKind, type OfficeTemplate } from '../core/file-formats/constants';
import { listOfficeFiles, OFFICE_FILES_CHANGED_EVENT, createOfficeFile } from '../services/office-storage';
import { officeAppForMime } from '../services/office-navigation';
import '../office.css';
import './office-hub.css';

const nativeApps: Record<OfficeDocumentKind, { app: AppId; title: string; description: string }> = {
  writer: { app: 'writer', title: 'NOVA Writer', description: 'Documents, reports, and letters' },
  sheets: { app: 'sheets', title: 'NOVA Sheets', description: 'Workbooks, formulas, and charts' },
  slides: { app: 'slides', title: 'NOVA Slides', description: 'Presentations and pitch decks' },
};

const templates: { kind: OfficeDocumentKind; template: OfficeTemplate; title: string; description: string }[] = [
  { kind: 'writer', template: 'blank', title: 'Blank document', description: 'Start with a clean page' },
  { kind: 'writer', template: 'meeting', title: 'Meeting notes', description: 'Agenda, attendees, and actions' },
  { kind: 'writer', template: 'letter', title: 'Letter', description: 'A structured formal letter' },
  { kind: 'sheets', template: 'blank', title: 'Blank workbook', description: 'A flexible formula-ready grid' },
  { kind: 'sheets', template: 'budget', title: 'Budget workbook', description: 'Categories, amounts, and totals' },
  { kind: 'slides', template: 'blank', title: 'Blank presentation', description: 'A title and content layout' },
  { kind: 'slides', template: 'pitch', title: 'Pitch deck', description: 'A concise product introduction' },
];

function KindIcon({ kind, size = 20 }: { kind: OfficeKind; size?: number }) {
  if (kind === 'writer') return <FileText size={size} />;
  if (kind === 'sheets') return <Sheet size={size} />;
  if (kind === 'slides') return <Presentation size={size} />;
  return <FileType2 size={size} />;
}

export default function OfficeHubApp() {
  const { t, formatDate } = useI18n();
  const { openApp } = useLauncher();
  const { preferences } = usePreferences();
  const [files, setFiles] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [section, setSection] = useState<'recent' | 'all' | 'templates'>('recent');
  const [filter, setFilter] = useState<'all' | OfficeKind>('all');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    try {
      setFiles(await listOfficeFiles());
      setError('');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener(OFFICE_FILES_CHANGED_EVENT, refresh);
    window.addEventListener('nova:data-imported', refresh);
    return () => {
      window.removeEventListener(OFFICE_FILES_CHANGED_EVENT, refresh);
      window.removeEventListener('nova:data-imported', refresh);
    };
  }, [load]);

  const createDocument = async (kind: OfficeDocumentKind, template: OfficeTemplate = 'blank') => {
    setBusy(`${kind}:${template}`);
    setError('');
    try {
      const name = kind === 'writer' ? 'Untitled document' : kind === 'sheets' ? 'Untitled workbook' : 'Untitled presentation';
      const created = await createOfficeFile(kind, name, template, undefined, true);
      openApp(nativeApps[kind].app, { recordId: created.file.id });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy('');
    }
  };
  const openFile = (file: FileNode) => {
    const app = officeAppForMime(file.mimeType);
    if (app) openApp(app, { recordId: file.id });
    else setError('This Office file format is not supported.');
  };
  const recentFiles = useMemo(() => {
    const byId = new Map(files.map((file) => [file.id, file]));
    return preferences.recentOfficeFiles.map((id) => byId.get(id)).filter((file): file is FileNode => Boolean(file));
  }, [files, preferences.recentOfficeFiles]);
  const visibleFiles = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return (section === 'recent' ? recentFiles : files).filter((file) => {
      const kind = officeKindFromMime(file.mimeType);
      return kind && (filter === 'all' || filter === kind) && (!needle || file.name.toLocaleLowerCase().includes(needle));
    });
  }, [section, recentFiles, files, filter, query]);
  const kindName = (kind: OfficeKind) => kind === 'writer' ? t('office.document') : kind === 'sheets' ? t('office.spreadsheet') : kind === 'slides' ? t('office.presentation') : t('pdf.document');

  return <div className="office-app office-hub-app">
    <header className="office-hub-header">
      <div className="office-hub-brand"><span><LayoutGrid size={22} /></span><div><h1>{t('office.suite')}</h1><p>{t('office.tagline')}</p></div></div>
      <button type="button" className="office-secondary-button" onClick={() => openApp('files')}><FolderOpen size={15} />{t('common.files')}</button>
    </header>
    <main className="office-hub-content app-scroll">
      <section className="office-hub-quick" aria-label="Create and open">
        {(Object.keys(nativeApps) as OfficeDocumentKind[]).map((kind) => <button key={kind} type="button" className={`office-hub-app-card is-${kind}`} disabled={Boolean(busy)} onClick={() => void createDocument(kind)}>
          <span className="office-hub-app-icon"><KindIcon kind={kind} size={23} /></span><span><strong>{nativeApps[kind].title}</strong><small>{nativeApps[kind].description}</small></span><Plus size={16} />
        </button>)}
        <button type="button" className="office-hub-app-card is-pdf" onClick={() => openApp('pdf')}><span className="office-hub-app-icon"><FileType2 size={23} /></span><span><strong>NOVA PDF</strong><small>Open and search local PDF files</small></span><ArrowRight size={16} /></button>
      </section>
      <nav className="office-hub-tabs" aria-label="Office library">
        <button type="button" className={section === 'recent' ? 'is-active' : ''} onClick={() => setSection('recent')}><Clock3 size={14} />{t('common.recent')}</button>
        <button type="button" className={section === 'all' ? 'is-active' : ''} onClick={() => setSection('all')}><FolderOpen size={14} />{t('office.allDocuments')}</button>
        <button type="button" className={section === 'templates' ? 'is-active' : ''} onClick={() => setSection('templates')}><LayoutGrid size={14} />{t('office.templates')}</button>
      </nav>
      {error && <div className="office-action-banner is-error" role="alert">{error}</div>}
      {section === 'templates' ? <section className="office-hub-templates">
        <div className="office-hub-section-heading"><div><p className="eyebrow">START QUICKLY</p><h2>{t('office.templates')}</h2></div></div>
        <div className="office-hub-template-grid">{templates.map((item) => <button key={`${item.kind}-${item.template}`} type="button" disabled={Boolean(busy)} onClick={() => void createDocument(item.kind, item.template)}>
          <span className={`office-hub-template-preview is-${item.kind}`}><KindIcon kind={item.kind} size={26} /><i /><i /><i /></span>
          <span><strong>{item.title}</strong><small>{item.description}</small></span><Plus size={15} />
        </button>)}</div>
      </section> : <section className="office-hub-library">
        <div className="office-hub-section-heading"><div><p className="eyebrow">YOUR LOCAL WORK</p><h2>{section === 'recent' ? t('office.recentDocuments') : t('office.allDocuments')}</h2></div><span>{visibleFiles.length}</span></div>
        <div className="office-hub-filters">
          <label className="office-hub-search"><Search size={14} /><span className="sr-only">{t('office.searchDocuments')}</span><input value={query} maxLength={200} placeholder={t('office.searchDocuments')} onChange={(event) => setQuery(event.target.value)} /></label>
          <select aria-label="Document type" value={filter} onChange={(event) => setFilter(event.target.value as 'all' | OfficeKind)}><option value="all">{t('common.all')}</option><option value="writer">{t('office.writer')}</option><option value="sheets">{t('office.sheets')}</option><option value="slides">{t('office.slides')}</option><option value="pdf">{t('office.pdf')}</option></select>
        </div>
        {loading ? <p className="office-hub-empty" role="status">{t('common.loading')}</p> : visibleFiles.length ? <div className="office-hub-document-list">{visibleFiles.map((file) => {
          const kind = officeKindFromMime(file.mimeType);
          if (!kind) return null;
          return <button type="button" key={file.id} className="office-hub-document" onClick={() => openFile(file)}>
            <span className={`office-hub-document-icon is-${kind}`}><KindIcon kind={kind} /></span><span className="office-hub-document-copy"><strong>{file.name}</strong><small>{kindName(kind)} · {t('office.lastEdited', { date: formatDate(file.updatedAt) })}</small></span><ArrowRight size={15} />
          </button>;
        })}</div> : <div className="office-hub-empty"><Search size={22} /><p>{query || filter !== 'all' ? t('office.noDocuments') : section === 'recent' ? 'No recent documents yet. Create something above to get started.' : t('office.noDocuments')}</p></div>}
      </section>}
    </main>
    <footer className="office-statusbar"><span>{t('office.localOffline')}</span><span className="office-statusbar-right">Native documents and PDFs are included in NOVA backups.</span></footer>
  </div>;
}
