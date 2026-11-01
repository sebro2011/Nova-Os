import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ChevronRight, Download, File, FilePlus2, FileText, Folder,
  FolderPlus, HardDrive, Home, Pencil, RotateCcw, Search, Trash2, Upload, X,
} from 'lucide-react';
import { AppError, AppLoading } from '../components/AppStates';
import { useNotifications } from '../context/NotificationContext';
import { useLauncher } from '../context/LaunchContext';
import { deleteRecords, getAllRecords, initializeDatabase, putRecord, putRecords } from '../lib/db';
import { getDescendantIds, getFolderPath, validateFileName } from '../lib/files';
import { usePhoneLayout } from '../hooks/useMediaQuery';
import { useModalFocus } from '../hooks/useModalFocus';
import { createId, downloadTextFile, errorMessage, formatBytes, formatDateTime } from '../lib/utils';
import type { FileNode } from '../types';

type DialogMode = 'create-folder' | 'create-file' | 'rename';

export default function FilesApp() {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState('home');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorFileId, setEditorFileId] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [dialog, setDialog] = useState<{ mode: DialogMode; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const uploadRef = useRef<HTMLInputElement>(null);
  const { notify } = useNotifications();
  const { consumeLaunchIntent } = useLauncher();
  const isPhone = usePhoneLayout();
  const dialogRef = useModalFocus<HTMLFormElement>(Boolean(dialog), () => setDialog(null));

  const load = useCallback(async () => {
    setError('');
    try {
      await initializeDatabase();
      const records = await getAllRecords<FileNode>('files');
      setFiles(records);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener('nova:data-imported', refresh);
    return () => window.removeEventListener('nova:data-imported', refresh);
  }, [load]);

  const selected = files.find((file) => file.id === selectedId);
  const editorFile = files.find((file) => file.id === editorFileId && file.kind === 'file');
  const currentFolder = files.find((file) => file.id === currentFolderId && file.kind === 'folder');
  const fallbackParentId = files.some((file) => file.id === 'home' && file.kind === 'folder' && !file.trashed) ? 'home' : 'root';
  const visibleFiles = useMemo(() => files
    .filter((file) => currentFolderId === 'trash' ? file.trashed : !file.trashed && file.parentId === currentFolderId)
    .filter((file) => file.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'folder' ? -1 : 1), [files, currentFolderId, query]);
  const fileSizes = useMemo(() => new Map(files.filter((file) => file.kind === 'file').map((file) => [file.id, new Blob([file.content]).size])), [files]);
  const breadcrumbs = currentFolderId === 'trash' ? [] : getFolderPath(currentFolderId, files);

  useEffect(() => {
    if (editorFile) setEditorContent(editorFile.content);
  }, [editorFileId, editorFile?.updatedAt]);

  const editorDirty = Boolean(editorFile && editorContent !== editorFile.content);

  useEffect(() => {
    if (loading) return;
    const intent = consumeLaunchIntent('files');
    if (!intent?.recordId) return;
    const target = files.find((file) => file.id === intent.recordId);
    if (!target) return;
    setQuery('');
    setSelectedId(target.id);
    if (target.trashed) setCurrentFolderId('trash');
    else if (target.kind === 'folder') setCurrentFolderId(target.id);
    else {
      setCurrentFolderId(target.parentId ?? 'root');
      setEditorFileId(target.id);
      setEditorContent(target.content);
    }
  }, [loading, files, consumeLaunchIntent]);

  useEffect(() => {
    if (loading || currentFolderId === 'trash') return;
    if (!files.some((file) => file.id === currentFolderId && file.kind === 'folder' && !file.trashed)) {
      setCurrentFolderId(files.some((file) => file.id === 'home' && file.kind === 'folder' && !file.trashed) ? 'home' : 'root');
      setSelectedId(null);
      setEditorFileId(null);
    }
  }, [loading, files, currentFolderId]);

  useEffect(() => {
    const guardClose = (event: Event) => {
      const detail = (event as CustomEvent<{ appId?: string }>).detail;
      if (detail?.appId === 'files' && editorDirty && !window.confirm('Close Files and discard unsaved text changes?')) event.preventDefault();
    };
    const guardUnload = (event: BeforeUnloadEvent) => {
      if (!editorDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('nova:before-close-window', guardClose);
    window.addEventListener('beforeunload', guardUnload);
    return () => {
      window.removeEventListener('nova:before-close-window', guardClose);
      window.removeEventListener('beforeunload', guardUnload);
    };
  }, [editorDirty]);

  const closeEditor = () => {
    if (editorDirty && !window.confirm('Discard unsaved text changes?')) return;
    setEditorFileId(null);
  };

  const navigate = (id: string) => {
    if (editorDirty && !window.confirm('Discard unsaved text changes?')) return;
    setCurrentFolderId(id);
    setSelectedId(null);
    setEditorFileId(null);
    setQuery('');
  };

  const openItem = (file: FileNode) => {
    if (file.kind === 'folder') navigate(file.id);
    else {
      setEditorFileId(file.id);
      setEditorContent(file.content);
    }
  };

  const assertUniqueName = (name: string, parentId: string | null, excludeId?: string) => {
    if (files.some((file) => file.id !== excludeId && !file.trashed && file.parentId === parentId && file.name.toLowerCase() === name.toLowerCase())) {
      throw new Error('An item with that name already exists in this folder.');
    }
  };

  const submitDialog = async () => {
    if (!dialog) return;
    try {
      const name = validateFileName(dialog.name);
      const now = new Date().toISOString();
      if (dialog.mode === 'rename') {
        if (!selected) throw new Error('Select an item to rename.');
        if (selected.id === 'root' || selected.id === 'home') throw new Error('The NOVA and Home folders cannot be renamed.');
        assertUniqueName(name, selected.parentId, selected.id);
        const updated = { ...selected, name, updatedAt: now };
        await putRecord('files', updated);
        setFiles((current) => current.map((file) => file.id === updated.id ? updated : file));
      } else {
        const parentId = currentFolderId === 'trash' ? fallbackParentId : currentFolderId;
        assertUniqueName(name, parentId);
        const node: FileNode = {
          id: createId(dialog.mode === 'create-folder' ? 'folder' : 'file'), parentId, name,
          kind: dialog.mode === 'create-folder' ? 'folder' : 'file', content: '',
          mimeType: dialog.mode === 'create-file' ? 'text/plain' : '',
          createdAt: now, updatedAt: now, trashed: false,
        };
        await putRecord('files', node);
        setFiles((current) => [...current, node]);
        setSelectedId(node.id);
      }
      setDialog(null);
    } catch (caught) {
      notify({ title: 'File operation not completed', message: errorMessage(caught), tone: 'warning' });
    }
  };

  const moveToTrash = async () => {
    if (!selected) return;
    if (selected.id === 'root' || selected.id === 'home') {
      notify({ title: 'Protected folder', message: 'The NOVA and Home folders cannot be deleted.', tone: 'warning' });
      return;
    }
    try {
      const ids = getDescendantIds(selected.id, files);
      const now = new Date().toISOString();
      const updated = files.filter((file) => ids.has(file.id)).map((file) => ({ ...file, trashed: true, originalParentId: file.parentId, updatedAt: now }));
      await putRecords('files', updated);
      setFiles((current) => current.map((file) => updated.find((change) => change.id === file.id) ?? file));
      setSelectedId(null);
      setEditorFileId(null);
      notify({ title: 'Moved to Trash', message: `${selected.name} can be restored from Trash.`, tone: 'success' });
    } catch (caught) {
      notify({ title: 'Could not move item to Trash', message: errorMessage(caught), tone: 'error' });
    }
  };

  const restoreSelected = async () => {
    if (!selected) return;
    try {
      const ids = getDescendantIds(selected.id, files);
      const restored = files.filter((file) => ids.has(file.id)).map((file) => {
        const parent = files.find((candidate) => candidate.id === file.originalParentId);
        const parentIsRestored = parent && (!parent.trashed || ids.has(parent.id));
        const { originalParentId: _originalParentId, ...withoutOriginal } = file;
        return { ...withoutOriginal, parentId: parentIsRestored ? file.originalParentId ?? fallbackParentId : fallbackParentId, trashed: false, updatedAt: new Date().toISOString() };
      });
      await putRecords('files', restored);
      setFiles((current) => current.map((file) => restored.find((change) => change.id === file.id) ?? file));
      setSelectedId(null);
      notify({ title: 'Item restored', message: `${selected.name} is back in your virtual file system.`, tone: 'success' });
    } catch (caught) {
      notify({ title: 'Restore failed', message: errorMessage(caught), tone: 'error' });
    }
  };

  const deleteForever = async () => {
    if (!selected || !window.confirm(`Permanently delete “${selected.name}”? This cannot be undone.`)) return;
    try {
      const ids = [...getDescendantIds(selected.id, files)];
      await deleteRecords('files', ids);
      setFiles((current) => current.filter((file) => !ids.includes(file.id)));
      setSelectedId(null);
      setEditorFileId(null);
    } catch (caught) {
      notify({ title: 'Permanent delete failed', message: errorMessage(caught), tone: 'error' });
    }
  };

  const saveFile = async () => {
    if (!editorFile) return;
    try {
      const updated = { ...editorFile, content: editorContent, updatedAt: new Date().toISOString() };
      await putRecord('files', updated);
      setFiles((current) => current.map((file) => file.id === updated.id ? updated : file));
      notify({ title: 'File saved', message: `${updated.name} is stored locally.`, tone: 'success' });
    } catch (caught) {
      notify({ title: 'File not saved', message: errorMessage(caught), tone: 'error' });
    }
  };

  const importTextFile = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 1_000_000) throw new Error('Text imports are limited to 1 MB per file.');
      const isText = file.type.startsWith('text/') || file.type === 'application/json' || /\.(txt|md|csv|json|log)$/i.test(file.name);
      if (!isText) throw new Error('Only plain-text files can be imported into the virtual editor.');
      const name = validateFileName(file.name);
      const parentId = currentFolderId === 'trash' ? fallbackParentId : currentFolderId;
      assertUniqueName(name, parentId);
      const content = await file.text();
      const now = new Date().toISOString();
      const node: FileNode = { id: createId('file'), parentId, name, kind: 'file', content, mimeType: 'text/plain', createdAt: now, updatedAt: now, trashed: false };
      await putRecord('files', node);
      setFiles((current) => [...current, node]);
      notify({ title: 'Text file imported', message: `${name} was copied into NOVA. The original was not changed.`, tone: 'success' });
    } catch (caught) {
      notify({ title: 'Import not completed', message: errorMessage(caught), tone: 'warning' });
    }
  };

  if (loading) return <AppLoading label="Opening your virtual file system…" />;
  if (error && !files.length) return <AppError message={error} onRetry={() => { setLoading(true); void load(); }} />;

  return (
    <div className="flex h-full bg-black/5">
      <aside className="hidden w-40 shrink-0 flex-col border-r border-ink/[0.06] bg-black/10 p-2.5 sm:flex">
        <p className="eyebrow px-2 py-2">PLACES</p>
        {[['home', 'Home', Home], ['root', 'All files', HardDrive]].map(([id, label, Icon]) => {
          const PlaceIcon = Icon as typeof Home;
          return <button key={id as string} className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${currentFolderId === id ? 'bg-[rgba(var(--accent-rgb),0.12)] accent-text' : 'text-ink/65 hover:bg-ink/[0.04]'}`} onClick={() => navigate(id as string)}><PlaceIcon size={15} />{label as string}</button>;
        })}
        <div className="my-2 h-px bg-ink/[0.06]" />
        <button className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs ${currentFolderId === 'trash' ? 'bg-ink/[0.07] text-ink/80' : 'text-ink/65 hover:bg-ink/[0.04]'}`} onClick={() => navigate('trash')}><Trash2 size={15} />Trash<span className="ml-auto text-[9px] text-muted">{files.filter((file) => file.trashed).length}</span></button>
        <div className="mt-auto rounded-xl border border-ink/[0.055] p-2.5 text-[9px] leading-4 text-muted">Virtual storage only.<br />No direct disk access.</div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-h-12 flex-wrap items-center gap-1 border-b border-ink/[0.06] px-2.5 py-2">
          <button className="icon-button" onClick={() => currentFolder?.parentId && navigate(currentFolder.parentId)} disabled={!currentFolder?.parentId} aria-label="Parent folder"><ArrowLeft size={15} /></button>
          <span className="mx-1 h-5 w-px bg-ink/[0.07]" />
          {currentFolderId !== 'trash' && <>
            <button className="icon-button" onClick={() => setDialog({ mode: 'create-folder', name: 'New folder' })} title="New folder" aria-label="New folder"><FolderPlus size={16} /></button>
            <button className="icon-button" onClick={() => setDialog({ mode: 'create-file', name: 'Untitled.txt' })} title="New text file" aria-label="New text file"><FilePlus2 size={16} /></button>
            <button className="icon-button" onClick={() => uploadRef.current?.click()} title="Import plain text" aria-label="Import plain text"><Upload size={15} /></button>
            <input ref={uploadRef} type="file" className="hidden" accept=".txt,.md,.csv,.json,.log,text/plain,application/json" onChange={(event) => { void importTextFile(event.target.files?.[0]); event.target.value = ''; }} />
          </>}
          <div className="ml-auto flex items-center gap-0.5">
            {selected?.trashed ? <>
              <button className="icon-button" onClick={() => void restoreSelected()} title="Restore" aria-label="Restore selected item"><RotateCcw size={15} /></button>
              <button className="icon-button hover:!text-red-300" onClick={() => void deleteForever()} title="Delete permanently" aria-label="Delete selected item permanently"><Trash2 size={15} /></button>
            </> : <>
              <button className="icon-button" onClick={() => selected && setDialog({ mode: 'rename', name: selected.name })} disabled={!selected} title="Rename" aria-label="Rename selected item"><Pencil size={14} /></button>
              <button className="icon-button" onClick={() => void moveToTrash()} disabled={!selected} title="Move to Trash" aria-label="Move selected item to Trash"><Trash2 size={15} /></button>
            </>}
          </div>
        </div>

        <nav className="app-scroll flex h-11 shrink-0 items-center gap-1 overflow-x-auto border-b border-ink/[0.05] px-2 sm:hidden" aria-label="File places">
          {[['home', 'Home', Home], ['root', 'All files', HardDrive], ['trash', 'Trash', Trash2]].map(([id, label, Icon]) => {
            const PlaceIcon = Icon as typeof Home;
            return <button key={id as string} className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[10px] ${currentFolderId === id ? 'bg-[rgba(var(--accent-rgb),0.12)] accent-text' : 'text-ink/65'}`} onClick={() => navigate(id as string)}><PlaceIcon size={13} />{label as string}</button>;
          })}
        </nav>

        <div className="flex h-10 items-center gap-1 overflow-x-auto border-b border-ink/[0.05] px-4 text-[11px] app-scroll">
          {currentFolderId === 'trash' ? <span className="flex items-center gap-2 text-ink/65"><Trash2 size={13} /> Trash</span> : breadcrumbs.map((folder, index) => <span key={folder.id} className="flex shrink-0 items-center gap-1">{index > 0 && <ChevronRight size={11} className="text-muted" />}<button className={`rounded px-1.5 py-1 hover:bg-ink/[0.05] ${index === breadcrumbs.length - 1 ? 'text-ink/75' : 'text-muted'}`} onClick={() => navigate(folder.id)}>{folder.name}</button></span>)}
          <label className="relative ml-auto block w-32 sm:w-44"><Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted" /><span className="sr-only">Search this folder</span><input className="nova-input !min-h-7 !py-1 !pl-7 !text-[10px]" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter names" /></label>
          <span className="hidden shrink-0 text-[9px] text-muted sm:inline">{visibleFiles.length} items</span>
        </div>

        <div className="relative min-h-0 flex-1">
          <div className="app-scroll h-full overflow-auto p-2">
            <div className="grid grid-cols-[1fr_auto] gap-2 px-3 py-1.5 text-[9px] uppercase tracking-wider text-muted sm:grid-cols-[1fr_150px_70px]"><span>Name</span><span className="hidden sm:block">Modified</span><span className="text-right">Size</span></div>
            {visibleFiles.map((file) => <button
              key={file.id}
              className={`grid w-full grid-cols-[1fr_auto] items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors sm:grid-cols-[1fr_150px_70px] ${selectedId === file.id ? 'bg-[rgba(var(--accent-rgb),0.11)]' : 'hover:bg-ink/[0.035]'}`}
              onClick={() => {
                if (isPhone && selectedId === file.id) openItem(file);
                else setSelectedId(file.id);
              }}
              onDoubleClick={() => { if (!isPhone) openItem(file); }}
              onKeyDown={(event) => { if (event.key === 'Enter') openItem(file); }}
              aria-label={`${file.kind === 'folder' ? 'Folder' : 'File'} ${file.name}. ${isPhone ? 'Tap to select, then tap again to open.' : 'Press Enter to open.'}`}
            >
              <span className="flex min-w-0 items-center gap-2.5">{file.kind === 'folder' ? <Folder size={17} className="accent-text shrink-0" /> : <FileText size={16} className="shrink-0 text-muted" />}<span className="truncate text-xs text-ink/70">{file.name}</span>{file.trashed && <span className="rounded bg-ink/[0.05] px-1 text-[8px] text-muted">TRASH</span>}</span>
              <span className="hidden text-[10px] text-muted sm:block">{formatDateTime(file.updatedAt)}</span>
              <span className="text-right text-[10px] text-muted">{file.kind === 'folder' ? '—' : formatBytes(fileSizes.get(file.id) ?? 0)}</span>
            </button>)}
            {visibleFiles.length === 0 && <div className="flex h-48 flex-col items-center justify-center text-center"><File size={26} className="text-ink/12" /><p className="mt-3 text-xs text-muted">{currentFolderId === 'trash' ? 'Trash is empty' : 'This folder is empty'}</p><p className="mt-1.5 text-[10px] text-muted">{currentFolderId === 'trash' ? 'Deleted items will wait here safely.' : isPhone ? 'Create an item, then tap it twice to open.' : 'Create a folder or plain-text file to begin.'}</p></div>}
          </div>

          {editorFile && <aside className="absolute inset-0 z-10 flex flex-col bg-[var(--editor-bg)]">
            <div className="flex items-center gap-2 border-b border-ink/[0.07] p-3"><FileText size={15} className="accent-text" /><div className="min-w-0 flex-1"><h3 className="truncate text-xs font-semibold">{editorFile.name}</h3><p className="text-[9px] text-muted">Plain text · stored in IndexedDB</p></div><button className="nova-button h-8 min-h-8 px-3 text-[11px]" onClick={() => void saveFile()}>Save</button>{!editorFile.trashed && <button className="icon-button" onClick={() => downloadTextFile(editorContent, editorFile.name, 'text/plain')} aria-label="Download a copy"><Download size={14} /></button>}<button className="icon-button" onClick={closeEditor} aria-label="Close editor"><X size={15} /></button></div>
            <textarea className="app-scroll min-h-0 flex-1 resize-none bg-transparent p-4 font-mono text-xs leading-6 text-ink/70 outline-none" value={editorContent} onChange={(event) => setEditorContent(event.target.value)} readOnly={editorFile.trashed} aria-label={`Contents of ${editorFile.name}`} spellCheck={false} />
            <div className="border-t border-ink/[0.055] px-4 py-2 text-[9px] text-muted">{editorContent.length.toLocaleString()} characters {editorFile.trashed && '· Restore this file to edit it'}</div>
          </aside>}
        </div>
      </section>

      {dialog && <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 p-5" onClick={() => setDialog(null)}><form ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={dialog.mode === 'rename' ? 'Rename item' : dialog.mode === 'create-folder' ? 'Create a folder' : 'Create a text file'} className="glass-panel w-full max-w-sm p-5" onClick={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); void submitDialog(); }}><h3 className="text-sm font-semibold">{dialog.mode === 'rename' ? 'Rename item' : dialog.mode === 'create-folder' ? 'Create a folder' : 'Create a text file'}</h3><p className="mt-1.5 text-[11px] text-muted">Use a unique name without slashes or control characters.</p><input className="nova-input mt-4" value={dialog.name} onChange={(event) => setDialog({ ...dialog, name: event.target.value })} maxLength={80} autoFocus onFocus={(event) => event.target.select()} aria-label="Item name" /><div className="mt-5 flex justify-end gap-2"><button type="button" className="nova-button nova-button-secondary" onClick={() => setDialog(null)}>Cancel</button><button type="submit" className="nova-button">Confirm</button></div></form></div>}
    </div>
  );
}
