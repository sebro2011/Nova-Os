import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CalendarDays, FileText, NotebookPen, Search } from 'lucide-react';
import { appRegistry, appList } from '../apps/registry';
import { getDatabaseSnapshot, initializeDatabase, type DatabaseSnapshot } from '../lib/db';
import { usePreferences } from '../context/PreferencesContext';
import type { AppId } from '../types';
import type { LucideIcon } from 'lucide-react';

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  appId: AppId;
  icon: LucideIcon;
}

export function SearchPalette({ onClose, onOpen }: { onClose: () => void; onOpen: (appId: AppId) => void }) {
  const [query, setQuery] = useState('');
  const [snapshot, setSnapshot] = useState<DatabaseSnapshot>({ files: [], notes: [], events: [], history: [] });
  const [selected, setSelected] = useState(0);
  const { preferences } = usePreferences();
  const systemReducedMotion = useReducedMotion();

  useEffect(() => {
    let active = true;
    initializeDatabase().then(getDatabaseSnapshot).then((data) => { if (active) setSnapshot(data); }).catch(() => {
      // Apps surface detailed storage errors; global search still searches built-in apps.
    });
    return () => { active = false; };
  }, []);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const apps: SearchResult[] = appList.filter((app) => !normalized || `${app.title} ${app.description}`.toLowerCase().includes(normalized)).map((app) => ({ id: app.id, title: app.title, subtitle: app.description, appId: app.id, icon: app.icon }));
    if (!normalized) return apps.slice(0, 7);
    const files: SearchResult[] = snapshot.files.filter((file) => !file.trashed && `${file.name} ${file.content.slice(0, 2_000)}`.toLowerCase().includes(normalized)).slice(0, 4).map((file) => ({ id: file.id, title: file.name, subtitle: 'Virtual file · open in Files', appId: 'files', icon: FileText }));
    const notes: SearchResult[] = snapshot.notes.filter((note) => `${note.title} ${note.content.slice(0, 2_000)}`.toLowerCase().includes(normalized)).slice(0, 4).map((note) => ({ id: note.id, title: note.title || 'Untitled note', subtitle: 'Note · open in Notes', appId: 'notes', icon: NotebookPen }));
    const events: SearchResult[] = snapshot.events.filter((event) => `${event.title} ${event.details}`.toLowerCase().includes(normalized)).slice(0, 3).map((event) => ({ id: event.id, title: event.title, subtitle: `Calendar event · ${event.date}`, appId: 'calendar', icon: CalendarDays }));
    return [...apps, ...files, ...notes, ...events].slice(0, 12);
  }, [query, snapshot]);

  useEffect(() => setSelected(0), [query]);

  const choose = (result?: SearchResult) => {
    if (!result) return;
    onOpen(result.appId);
    onClose();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setSelected((current) => Math.min(current + 1, results.length - 1)); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setSelected((current) => Math.max(current - 1, 0)); }
    if (event.key === 'Enter') { event.preventDefault(); choose(results[selected]); }
  };

  return (
    <div className="fixed inset-0 z-[11000] flex items-start justify-center bg-black/25 p-3 pt-[10vh] backdrop-blur-[2px]" onClick={onClose}>
      <motion.section
        className="glass-panel w-full max-w-xl overflow-hidden !rounded-[20px]"
        initial={systemReducedMotion || preferences.reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Global search"
      >
        <label className="flex items-center gap-3 border-b border-white/[0.08] px-4">
          <Search size={19} className="accent-text shrink-0" />
          <span className="sr-only">Search apps, files, notes, and events</span>
          <input className="h-14 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30" placeholder="Search apps, files, notes, and events…" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={onKeyDown} autoFocus />
          <kbd className="rounded-md border border-white/10 px-1.5 py-1 text-[9px] text-white/35">ESC</kbd>
        </label>
        <div className="app-scroll max-h-[55vh] overflow-y-auto p-2">
          <p className="eyebrow px-2 py-2">{query ? `${results.length} RESULTS` : 'QUICK LAUNCH'}</p>
          {results.map((result, index) => {
            const Icon = result.icon;
            return <button key={`${result.appId}-${result.id}`} className={`flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors ${selected === index ? 'bg-white/[0.075]' : 'hover:bg-white/[0.04]'}`} onMouseEnter={() => setSelected(index)} onClick={() => choose(result)}><span className="accent-surface flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"><Icon size={17} /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium text-white/85">{result.title}</span><span className="mt-0.5 block truncate text-[10px] text-white/35">{result.subtitle}</span></span><span className="text-[9px] uppercase tracking-wider text-white/25">{appRegistry[result.appId].title}</span></button>;
          })}
          {results.length === 0 && <div className="px-5 py-10 text-center"><p className="text-sm text-white/50">Nothing found in this orbit</p><p className="mt-2 text-xs text-white/30">Try an app name, note, file, or event.</p></div>}
        </div>
        <div className="flex items-center gap-4 border-t border-white/[0.06] px-4 py-2.5 text-[9px] text-white/25"><span>↑↓ Navigate</span><span>↵ Open</span><span className="ml-auto">Local search only</span></div>
      </motion.section>
    </div>
  );
}
