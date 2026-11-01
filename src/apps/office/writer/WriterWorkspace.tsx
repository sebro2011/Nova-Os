import { useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type SetStateAction } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, ChevronLeft, ChevronRight,
  Columns3, Download, FilePlus2, FileUp, History, Image, Italic, Link2, List, ListOrdered,
  Printer, Redo2, Rows3, Save, Search, Settings2, Strikethrough, Table, Trash2,
  Underline, Undo2, X,
} from 'lucide-react';
import type { FileNode } from '../../../types';
import type { OfficeSaveStatus } from '../core/autosave/useOfficeDocument';
import { validateWriterDocument, type WriterDocument } from '../core/document-model/writer-model';
import { OFFICE_EXTENSION, OFFICE_MIME } from '../core/file-formats/constants';
import { serializeOfficeData } from '../core/file-formats/native';
import { officeLink } from '../core/file-formats/validation';
import { readRasterInfo } from '../core/file-formats/raster';
import { downloadBlob, downloadText, readFileAsDataUrl } from '../services/download';
import { errorMessage } from '../../../lib/utils';
import { useI18n } from '../../../context/LocalizationContext';
import { OfficeDialog, OfficeMenu, OfficeSaveIndicator, OfficeToolbarButton, OfficeWarnings } from '../components/OfficeUI';
import OfficeRevisionDialog from '../components/OfficeRevisionDialog';
import { writerExtensions } from './writer-schema';
import { findWriterMatches, replaceWriterMatches, selectWriterMatch } from './writer-find';
import { importDocx, importPlainText } from './writer-import';

interface WriterWorkspaceProps {
  file: FileNode;
  data: WriterDocument;
  status: OfficeSaveStatus;
  error: string;
  updateData: (update: SetStateAction<WriterDocument>) => void;
  rename: (name: string) => void;
  flush: (forceRevision?: boolean) => Promise<void>;
  createNew: () => Promise<void>;
}

const fontFamilies = ['Arial', 'Georgia', 'Times New Roman', 'Courier New', 'sans-serif'];
const fontSizes = [10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48];

export default function WriterWorkspace({ file, data, status, error, updateData, rename, flush, createNew }: WriterWorkspaceProps) {
  const { t } = useI18n();
  const dataRef = useRef(data);
  dataRef.current = data;
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [matchIndex, setMatchIndex] = useState(0);
  const [linkOpen, setLinkOpen] = useState(false);
  const [revisionsOpen, setRevisionsOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('https://');
  const importRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const editor = useEditor({
    extensions: writerExtensions,
    content: data.content,
    editorProps: { attributes: { class: 'writer-prose', 'aria-label': t('writer.documentContent'), spellcheck: 'true' } },
    onUpdate: ({ editor: current }) => {
      const next = { ...dataRef.current, content: current.getJSON() };
      dataRef.current = next;
      updateData(next);
    },
  });
  const editorState = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      document: current.state.doc,
      bold: current.isActive('bold'),
      italic: current.isActive('italic'),
      underline: current.isActive('underline'),
      strike: current.isActive('strike'),
      bulletList: current.isActive('bulletList'),
      orderedList: current.isActive('orderedList'),
      align: ['left', 'center', 'right', 'justify'].find((value) => current.isActive({ textAlign: value })) ?? 'left',
      fontFamily: String(current.getAttributes('textStyle').fontFamily ?? 'Arial'),
      fontSize: String(current.getAttributes('textStyle').fontSize ?? '12px'),
      words: current.storage.characterCount.words(),
      characters: current.storage.characterCount.characters(),
    }),
  });
  const matches = useMemo(() => editor && findOpen ? findWriterMatches(editor, query) : [], [editor, editorState?.document, findOpen, query]);

  const runAction = async (action: () => Promise<void>) => {
    setBusy(true);
    setActionError('');
    try {
      await action();
    } catch (caught) {
      setActionError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const exportNative = () => runAction(async () => {
    const current = validateWriterDocument(dataRef.current);
    downloadText(serializeOfficeData('writer', current), `${file.name.replace(/\.nwdoc$/i, '')}${OFFICE_EXTENSION.writer}`, OFFICE_MIME.writer);
  });

  const exportDocx = () => runAction(async () => {
    await flush();
    const { exportWriterDocx } = await import('./writer-export');
    const blob = await exportWriterDocx(dataRef.current, file.name.replace(/\.nwdoc$/i, ''));
    downloadBlob(blob, `${file.name.replace(/\.nwdoc$/i, '')}.docx`);
  });

  const exportText = () => runAction(async () => {
    const { writerPlainText } = await import('./writer-text');
    downloadText(writerPlainText(dataRef.current), `${file.name.replace(/\.nwdoc$/i, '')}.txt`, 'text/plain');
  });

  const exportPdf = () => runAction(async () => {
    if (!editor) return;
    await flush();
    const { exportWriterPdf } = await import('./writer-pdf');
    const blob = await exportWriterPdf(dataRef.current, editor.getHTML());
    downloadBlob(blob, `${file.name.replace(/\.nwdoc$/i, '')}.pdf`);
  });

  const printDocument = () => runAction(async () => {
    if (!editor) return;
    const { printWriter } = await import('./writer-print');
    printWriter(dataRef.current, editor.getHTML());
  });

  const importDocument = (selected?: File) => {
    if (!selected || !editor) return;
    void runAction(async () => {
      const extension = selected.name.split('.').pop()?.toLowerCase();
      if (extension === 'docx') {
        const result = await importDocx(selected, dataRef.current.page);
        dataRef.current = result.document;
        updateData(result.document);
        editor.commands.setContent(result.document.content, { emitUpdate: false });
        setWarnings(['Review the imported layout. NOVA preserves supported DOCX content but does not claim full Microsoft Word compatibility.', ...result.warnings]);
      } else if (extension === 'txt') {
        if (selected.size > 2_000_000) throw new Error('Plain-text imports are limited to 2 million characters.');
        const document = importPlainText(await selected.text(), dataRef.current.page);
        dataRef.current = document;
        updateData(document);
        editor.commands.setContent(document.content, { emitUpdate: false });
        setWarnings([]);
      } else throw new Error('Choose a DOCX or TXT file. PDF files open in NOVA PDF; editable PDF text import is a separate compatibility action.');
    });
  };

  const insertImage = (selected?: File) => {
    if (!selected || !editor) return;
    void runAction(async () => {
      if (selected.size > 4_500_000) throw new Error('Writer images are limited to 4.5 MB each.');
      const source = await readFileAsDataUrl(selected);
      readRasterInfo(source);
      const image = new window.Image();
      image.src = source;
      await image.decode();
      editor.chain().focus().setImage({ src: source, alt: selected.name.slice(0, 300) }).run();
    });
  };

  const applyLink = () => {
    if (!editor) return;
    try {
      const href = officeLink(linkUrl);
      if (editor.state.selection.empty) editor.chain().focus().insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] }).run();
      else editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
      setLinkOpen(false);
      setActionError('');
    } catch (caught) {
      setActionError(errorMessage(caught));
    }
  };

  const goToMatch = (index: number) => {
    if (!editor || !matches.length) return;
    const next = (index + matches.length) % matches.length;
    setMatchIndex(next);
    selectWriterMatch(editor, matches[next]);
  };

  const handleKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    if (event.key.toLowerCase() === 's') {
      event.preventDefault();
      void flush(true);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      setFindOpen(true);
    } else if (event.key.toLowerCase() === 'h') {
      event.preventDefault();
      setFindOpen(true);
    }
  };

  const title = file.name.replace(/\.nwdoc$/i, '');
  const pageDimensions = data.page.size === 'A4' ? { width: 794, minHeight: 1123 } : { width: 816, minHeight: 1056 };
  const margin = data.page.marginMm / 25.4 * 96;

  return <div className="office-app writer-app" onKeyDown={handleKeyboard}>
    <header className="office-app-header">
      <input className="office-title-input" aria-label={t('common.name')} value={title} maxLength={120} onChange={(event) => rename(event.target.value)} />
      <OfficeSaveIndicator status={status} />
      <button type="button" className="office-primary-button" onClick={() => void flush(true)} disabled={busy}><Save size={14} />{t('common.save')}</button>
    </header>
    <div className="office-toolbar" role="toolbar" aria-label={t('writer.tools')}>
      <OfficeMenu label={t('common.file')}>
        <button className="office-menu-item" onClick={() => void createNew()}><FilePlus2 size={14} />{t('office.newDocument')}</button>
        <button className="office-menu-item" onClick={() => importRef.current?.click()}><FileUp size={14} />{t('writer.importDocxText')}</button>
        <button className="office-menu-item" onClick={() => setRevisionsOpen(true)}><History size={14} />{t('office.revisionHistory')}</button>
        <button className="office-menu-item" onClick={exportNative}><Download size={14} />{t('writer.exportNative')}</button>
        <button className="office-menu-item" onClick={() => void exportDocx()} disabled={busy}><Download size={14} />{t('writer.exportDocx')}</button>
        <button className="office-menu-item" onClick={() => void exportText()} disabled={busy}><Download size={14} />{t('writer.exportText')}</button>
        <button className="office-menu-item" onClick={() => void exportPdf()} disabled={busy}><Download size={14} />{t('writer.exportPdf')}</button>
        <button className="office-menu-item" onClick={() => void printDocument()} disabled={busy}><Printer size={14} />{t('common.print')}</button>
      </OfficeMenu>
      <span className="office-toolbar-divider" />
      <OfficeToolbarButton label={t('common.undo')} onClick={() => editor?.chain().focus().undo().run()} disabled={!editor?.can().undo()}><Undo2 size={15} /></OfficeToolbarButton>
      <OfficeToolbarButton label={t('common.redo')} onClick={() => editor?.chain().focus().redo().run()} disabled={!editor?.can().redo()}><Redo2 size={15} /></OfficeToolbarButton>
      <select className="office-select office-heading-select" aria-label={t('writer.paragraph')} value={editor?.isActive('heading') ? `h${editor.getAttributes('heading').level}` : 'p'} onChange={(event) => {
        if (!editor) return;
        if (event.target.value === 'p') editor.chain().focus().setParagraph().run();
        else editor.chain().focus().toggleHeading({ level: Number(event.target.value.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6 }).run();
      }}>
        <option value="p">{t('writer.paragraph')}</option>{[1, 2, 3, 4, 5, 6].map((level) => <option key={level} value={`h${level}`}>{t('writer.heading', { level })}</option>)}
      </select>
      <select className="office-select" aria-label={t('writer.font')} value={editorState?.fontFamily ?? 'Arial'} onChange={(event) => editor?.chain().focus().setFontFamily(event.target.value).run()}>{fontFamilies.map((font) => <option key={font} value={font}>{font}</option>)}</select>
      <select className="office-select office-size-select" aria-label={t('writer.fontSize')} value={editorState?.fontSize ?? '12px'} onChange={(event) => editor?.chain().focus().setFontSize(event.target.value).run()}>{fontSizes.map((size) => <option key={size} value={`${size}px`}>{size}</option>)}</select>
      <span className="office-toolbar-divider" />
      <OfficeToolbarButton label={t('writer.bold')} active={editorState?.bold} onClick={() => editor?.chain().focus().toggleBold().run()}><Bold size={15} /></OfficeToolbarButton>
      <OfficeToolbarButton label={t('writer.italic')} active={editorState?.italic} onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic size={15} /></OfficeToolbarButton>
      <OfficeToolbarButton label={t('writer.underline')} active={editorState?.underline} onClick={() => editor?.chain().focus().toggleUnderline().run()}><Underline size={15} /></OfficeToolbarButton>
      <OfficeToolbarButton label={t('writer.strike')} active={editorState?.strike} onClick={() => editor?.chain().focus().toggleStrike().run()}><Strikethrough size={15} /></OfficeToolbarButton>
      <label className="office-color-control" title={t('writer.textColor')}><span className="sr-only">{t('writer.textColor')}</span><input type="color" value={/^#[\da-f]{6}$/i.test(editor?.getAttributes('textStyle').color ?? '') ? editor?.getAttributes('textStyle').color : '#172033'} onChange={(event) => editor?.chain().focus().setColor(event.target.value).run()} /></label>
      <span className="office-toolbar-divider" />
      {(['left', 'center', 'right', 'justify'] as const).map((align) => {
        const Icon = align === 'left' ? AlignLeft : align === 'center' ? AlignCenter : align === 'right' ? AlignRight : AlignJustify;
        const key = align === 'left' ? 'writer.alignLeft' : align === 'center' ? 'writer.alignCenter' : align === 'right' ? 'writer.alignRight' : 'writer.alignJustify';
        return <OfficeToolbarButton key={align} label={t(key)} active={editorState?.align === align} onClick={() => editor?.chain().focus().setTextAlign(align).run()}><Icon size={15} /></OfficeToolbarButton>;
      })}
      <OfficeToolbarButton label={t('writer.bulletList')} active={editorState?.bulletList} onClick={() => editor?.chain().focus().toggleBulletList().run()}><List size={15} /></OfficeToolbarButton>
      <OfficeToolbarButton label={t('writer.orderedList')} active={editorState?.orderedList} onClick={() => editor?.chain().focus().toggleOrderedList().run()}><ListOrdered size={15} /></OfficeToolbarButton>
      <span className="office-toolbar-divider" />
      <OfficeToolbarButton label={t('writer.link')} onClick={() => { setLinkUrl(editor?.getAttributes('link').href ?? 'https://'); setLinkOpen(true); }}><Link2 size={15} /></OfficeToolbarButton>
      <OfficeToolbarButton label={t('writer.image')} onClick={() => imageRef.current?.click()}><Image size={15} /></OfficeToolbarButton>
      <OfficeMenu label={t('writer.table')} icon={<Table size={14} />}>
        <button className="office-menu-item" onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table size={14} />{t('writer.table')}</button>
        <button className="office-menu-item" onClick={() => editor?.chain().focus().addRowAfter().run()}><Rows3 size={14} />{t('writer.addRow')}</button>
        <button className="office-menu-item" onClick={() => editor?.chain().focus().addColumnAfter().run()}><Columns3 size={14} />{t('writer.addColumn')}</button>
        <button className="office-menu-item danger" onClick={() => editor?.chain().focus().deleteTable().run()}><Trash2 size={14} />{t('writer.deleteTable')}</button>
      </OfficeMenu>
      <OfficeToolbarButton label={t('writer.find')} active={findOpen} onClick={() => setFindOpen((current) => !current)}><Search size={15} /></OfficeToolbarButton>
      <OfficeToolbarButton label={t('writer.pageLayout')} active={layoutOpen} onClick={() => setLayoutOpen((current) => !current)}><Settings2 size={15} /></OfficeToolbarButton>
    </div>
    {(error || actionError || busy) && <div className={`office-action-banner ${error || actionError ? 'is-error' : ''}`} role={error || actionError ? 'alert' : 'status'}>{error || actionError || t('common.loading')}</div>}
    <OfficeWarnings warnings={warnings} onDismiss={() => setWarnings([])} />
    {findOpen && <section className="writer-find-panel" aria-label={t('writer.find')}>
      <Search size={14} /><input className="office-input" value={query} maxLength={200} placeholder={t('writer.find')} onChange={(event) => { setQuery(event.target.value); setMatchIndex(0); }} />
      <span className="writer-match-count">{t('writer.matches', { count: matches.length })}</span>
      <OfficeToolbarButton label={t('common.previous')} onClick={() => goToMatch(matchIndex - 1)} disabled={!matches.length}><ChevronLeft size={14} /></OfficeToolbarButton>
      <OfficeToolbarButton label={t('common.next')} onClick={() => goToMatch(matchIndex + 1)} disabled={!matches.length}><ChevronRight size={14} /></OfficeToolbarButton>
      <input className="office-input" value={replacement} maxLength={2000} placeholder={t('writer.replace')} onChange={(event) => setReplacement(event.target.value)} />
      <button className="office-secondary-button" disabled={!matches.length || !editor} onClick={() => { if (editor && matches[matchIndex]) replaceWriterMatches(editor, [matches[matchIndex]], replacement, true); }}>{t('writer.replace')}</button>
      <button className="office-secondary-button" disabled={!matches.length || !editor} onClick={() => { if (editor) replaceWriterMatches(editor, matches, replacement); }}>{t('writer.replaceAll')}</button>
      <OfficeToolbarButton label={t('common.close')} onClick={() => setFindOpen(false)}><X size={14} /></OfficeToolbarButton>
    </section>}
    <div className="writer-main">
      <div className="writer-canvas app-scroll">
        <article className="writer-page" style={{ width: pageDimensions.width, minHeight: pageDimensions.minHeight, padding: margin }}>
          {data.page.header && <header className="writer-page-header">{data.page.header}</header>}
          <EditorContent editor={editor} className="writer-editor-content" />
          {(data.page.footer || data.page.showPageNumbers) && <footer className="writer-page-footer"><span>{data.page.footer}</span>{data.page.showPageNumbers && <span aria-label={t('writer.pageNumberPreview')}>1</span>}</footer>}
        </article>
      </div>
      {layoutOpen && <aside className="office-side-panel app-scroll" aria-label={t('writer.pageLayout')}>
        <div className="office-panel-heading"><h2>{t('writer.pageLayout')}</h2><OfficeToolbarButton label={t('common.close')} onClick={() => setLayoutOpen(false)}><X size={14} /></OfficeToolbarButton></div>
        <label className="office-field"><span>{t('writer.paperSize')}</span><select className="office-input" value={data.page.size} onChange={(event) => updateData((current) => ({ ...current, page: { ...current.page, size: event.target.value as 'A4' | 'Letter' } }))}><option value="A4">A4</option><option value="Letter">Letter</option></select></label>
        <label className="office-field"><span>{t('writer.margins')} ({data.page.marginMm} mm)</span><input type="range" min={8} max={40} step={1} value={data.page.marginMm} onChange={(event) => updateData((current) => ({ ...current, page: { ...current.page, marginMm: Number(event.target.value) } }))} /></label>
        <label className="office-field"><span>{t('writer.header')}</span><textarea className="office-input" rows={2} maxLength={2000} value={data.page.header} onChange={(event) => updateData((current) => ({ ...current, page: { ...current.page, header: event.target.value } }))} /></label>
        <label className="office-field"><span>{t('writer.footer')}</span><textarea className="office-input" rows={2} maxLength={2000} value={data.page.footer} onChange={(event) => updateData((current) => ({ ...current, page: { ...current.page, footer: event.target.value } }))} /></label>
        <label className="office-checkbox-field"><input type="checkbox" checked={data.page.showPageNumbers} onChange={(event) => updateData((current) => ({ ...current, page: { ...current.page, showPageNumbers: event.target.checked } }))} /><span>{t('writer.pageNumbers')}</span></label>
        <p className="office-panel-note">{t('writer.layoutNote')}</p>
      </aside>}
    </div>
    <footer className="office-statusbar"><span>{t('writer.words', { count: editorState?.words ?? 0 })}</span><span>{t('writer.characters', { count: editorState?.characters ?? 0 })}</span><span className="office-statusbar-right">{t('office.localOffline')}</span></footer>
    <input ref={importRef} type="file" className="hidden" accept=".docx,.txt,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={(event: ChangeEvent<HTMLInputElement>) => { importDocument(event.target.files?.[0]); event.target.value = ''; }} />
    <input ref={imageRef} type="file" className="hidden" accept="image/png,image/jpeg,image/webp" onChange={(event) => { insertImage(event.target.files?.[0]); event.target.value = ''; }} />
    {revisionsOpen && <OfficeRevisionDialog fileId={file.id} kind="writer" onClose={() => setRevisionsOpen(false)} onRestore={(revision) => { const restored = validateWriterDocument(revision); dataRef.current = restored; updateData(restored); editor?.commands.setContent(restored.content, { emitUpdate: false }); }} />}
    {linkOpen && <OfficeDialog title={t('writer.link')} onClose={() => setLinkOpen(false)} footer={<><button className="office-secondary-button" onClick={() => setLinkOpen(false)}>{t('common.cancel')}</button><button className="office-primary-button" onClick={applyLink}>{t('common.save')}</button></>}><label className="office-field"><span>URL</span><input className="office-input" type="url" value={linkUrl} maxLength={2000} onChange={(event) => setLinkUrl(event.target.value)} placeholder="https://example.com" /></label><p className="office-panel-note">{t('writer.linkNote')}</p></OfficeDialog>}
  </div>;
}
