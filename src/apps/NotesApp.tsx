import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, FileText, List, Plus, Search, Trash2 } from 'lucide-react';
import { AppError, AppLoading } from '../components/AppStates';
import { useNotifications } from '../context/NotificationContext';
import { useLauncher } from '../context/LaunchContext';
import { deleteRecord, getAllRecords, initializeDatabase, putRecord } from '../lib/db';
import { createId, errorMessage, formatDateTime } from '../lib/utils';
import type { Note } from '../types';

export default function NotesApp() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saveState, setSaveState] = useState('Saved locally');
  const [mobileList, setMobileList] = useState(false);
  const timers = useRef(new Map<string, number>());
  const pendingNotes = useRef(new Map<string, { note: Note; revision: number }>());
  const revisions = useRef(new Map<string, number>());
  const inFlight = useRef(new Map<string, Promise<void>>());
  const selectedIdRef = useRef<string | null>(null);
  const { notify } = useNotifications();
  const { consumeLaunchIntent } = useLauncher();

  const load = useCallback(async () => {
    setError('');
    try {
      await initializeDatabase();
      const records = await getAllRecords<Note>('notes');
      records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setNotes(records);
      setSelectedId((current) => current && records.some((note) => note.id === current) ? current : records[0]?.id ?? null);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const refresh = () => {
      timers.current.forEach(window.clearTimeout);
      timers.current.clear();
      pendingNotes.current.clear();
      void load();
    };
    window.addEventListener('nova:data-imported', refresh);
    return () => window.removeEventListener('nova:data-imported', refresh);
  }, [load]);

  useEffect(() => () => {
    timers.current.forEach(window.clearTimeout);
    timers.current.clear();
    pendingNotes.current.forEach(({ note }) => {
      void putRecord('notes', note).catch(() => undefined);
    });
  }, []);

  useEffect(() => {
    selectedIdRef.current = selectedId;
    if (selectedId) setSaveState(pendingNotes.current.has(selectedId) ? 'Saving…' : 'Saved locally');
  }, [selectedId]);

  useEffect(() => {
    if (loading) return;
    const intent = consumeLaunchIntent('notes');
    if (!intent?.recordId) return;
    const target = notes.find((note) => note.id === intent.recordId);
    if (target) {
      setSelectedId(target.id);
      setMobileList(false);
    }
  }, [loading, notes, consumeLaunchIntent]);

  const selected = notes.find((note) => note.id === selectedId);
  const filtered = notes.filter((note) => `${note.title} ${note.content}`.toLowerCase().includes(query.toLowerCase()));

  const updateSaveStatus = (id: string, failed = false) => {
    if (selectedIdRef.current !== id) return;
    setSaveState(failed ? 'Save failed — export a backup and retry' : pendingNotes.current.has(id) ? 'Saving…' : 'Saved locally');
  };

  const persist = async (note: Note, revision: number) => {
    const operation = putRecord('notes', note);
    inFlight.current.set(note.id, operation);
    let failed = false;
    try {
      await operation;
      if (pendingNotes.current.get(note.id)?.revision === revision) pendingNotes.current.delete(note.id);
    } catch {
      failed = true;
    } finally {
      if (inFlight.current.get(note.id) === operation) inFlight.current.delete(note.id);
      updateSaveStatus(note.id, failed);
    }
  };

  const updateSelected = (patch: Partial<Note>) => {
    if (!selected) return;
    const updated = { ...selected, ...patch, updatedAt: new Date().toISOString() };
    const revision = (revisions.current.get(updated.id) ?? 0) + 1;
    revisions.current.set(updated.id, revision);
    pendingNotes.current.set(updated.id, { note: updated, revision });
    const previousTimer = timers.current.get(updated.id);
    if (previousTimer !== undefined) window.clearTimeout(previousTimer);
    const timer = window.setTimeout(() => {
      timers.current.delete(updated.id);
      void persist(updated, revision);
    }, 450);
    timers.current.set(updated.id, timer);
    setNotes((current) => current.map((note) => note.id === updated.id ? updated : note));
    setSaveState('Saving…');
  };

  const createNote = async () => {
    const now = new Date().toISOString();
    const note: Note = { id: createId('note'), title: 'Untitled note', content: '', createdAt: now, updatedAt: now };
    try {
      await putRecord('notes', note);
      setNotes((current) => [note, ...current]);
      setSelectedId(note.id);
      setMobileList(false);
      setSaveState('Saved locally');
    } catch (caught) {
      notify({ title: 'Could not create note', message: errorMessage(caught), tone: 'error' });
    }
  };

  const removeNote = async () => {
    if (!selected || !window.confirm(`Delete “${selected.title || 'Untitled note'}”? This cannot be undone.`)) return;
    const id = selected.id;
    try {
      const timer = timers.current.get(id);
      if (timer !== undefined) window.clearTimeout(timer);
      timers.current.delete(id);
      pendingNotes.current.delete(id);
      revisions.current.set(id, (revisions.current.get(id) ?? 0) + 1);
      await inFlight.current.get(id)?.catch(() => undefined);
      await deleteRecord('notes', id);
      const remaining = notes.filter((note) => note.id !== id);
      setNotes(remaining);
      setSelectedId(remaining[0]?.id ?? null);
    } catch (caught) {
      notify({ title: 'Could not delete note', message: errorMessage(caught), tone: 'error' });
    }
  };

  if (loading) return <AppLoading label="Opening your notes…" />;
  if (error && !notes.length) return <AppError message={error} onRetry={() => { setLoading(true); void load(); }} />;

  return (
    <div className="relative flex h-full bg-black/5">
      <aside className={`${mobileList ? 'absolute inset-0 z-20 flex bg-[var(--editor-bg)]' : 'hidden'} w-full shrink-0 flex-col border-r border-ink/[0.06] bg-black/10 sm:relative sm:flex sm:w-56`}>
        <div className="p-3 pb-2">
          <div className="flex items-center gap-2"><p className="eyebrow flex-1">NOTEBOOK</p><button className="icon-button h-8 w-8" onClick={() => void createNote()} aria-label="Create note"><Plus size={16} /></button></div>
          <label className="relative mt-3 block"><Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" /><span className="sr-only">Search notes</span><input className="nova-input !min-h-8 !py-1.5 !pl-8 !text-[11px]" placeholder="Search notes" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        </div>
        <div className="app-scroll min-h-0 flex-1 overflow-y-auto p-2">
          {filtered.map((note) => <button key={note.id} className={`mb-1 w-full rounded-xl border p-3 text-left transition-colors ${selectedId === note.id ? 'border-[rgba(var(--accent-rgb),0.18)] bg-[rgba(var(--accent-rgb),0.09)]' : 'border-transparent hover:bg-ink/[0.035]'}`} onClick={() => { setSelectedId(note.id); setMobileList(false); }}><span className="block truncate text-xs font-medium text-ink/75">{note.title || 'Untitled note'}</span><span className="mt-1.5 block truncate text-[10px] text-muted">{note.content || 'No additional text'}</span><span className="mt-2 block text-[9px] text-muted">{formatDateTime(note.updatedAt)}</span></button>)}
          {!filtered.length && <p className="p-6 text-center text-[11px] text-muted">No notes found.</p>}
        </div>
        <p className="border-t border-ink/[0.055] p-3 text-[9px] text-muted">{notes.length} notes · IndexedDB</p>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        {selected ? <>
          <div className="flex h-12 shrink-0 items-center gap-2 border-b border-ink/[0.06] px-3">
            <button className="icon-button sm:hidden" onClick={() => setMobileList(true)} aria-label="Show notes list"><List size={16} /></button>
            <span className={`flex items-center gap-1.5 text-[10px] ${saveState.includes('failed') ? 'text-red-300' : 'text-muted'}`} role="status">{saveState === 'Saved locally' && <Check size={12} className="text-emerald-300/60" />}{saveState}</span>
            <button className="icon-button ml-auto hover:!text-red-300" onClick={() => void removeNote()} aria-label="Delete note"><Trash2 size={15} /></button>
          </div>
          <input className="shrink-0 border-b border-ink/[0.045] bg-transparent px-5 py-4 text-xl font-semibold tracking-tight text-ink/85 outline-none placeholder:text-muted sm:px-7" value={selected.title} onChange={(event) => updateSelected({ title: event.target.value.slice(0, 160) })} placeholder="Untitled note" aria-label="Note title" />
          <textarea className="app-scroll min-h-0 flex-1 resize-none bg-transparent px-5 py-5 text-[13px] leading-7 text-ink/65 outline-none placeholder:text-muted sm:px-7" value={selected.content} onChange={(event) => updateSelected({ content: event.target.value.slice(0, 1_000_000) })} placeholder="Write what’s on your mind…" aria-label="Note content" />
          <div className="flex shrink-0 items-center border-t border-ink/[0.05] px-4 py-2 text-[9px] text-muted"><span>{selected.content.trim() ? selected.content.trim().split(/\s+/).length : 0} words</span><span className="ml-auto">Autosaves after a short pause</span></div>
        </> : <div className="flex flex-1 flex-col items-center justify-center p-6 text-center"><FileText size={28} className="text-ink/15" /><p className="mt-4 text-sm text-ink/65">A blank page, infinite possibilities.</p><button className="nova-button mt-5" onClick={() => void createNote()}><Plus size={15} /> Create a note</button></div>}
      </section>
    </div>
  );
}
