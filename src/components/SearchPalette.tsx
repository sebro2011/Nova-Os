import { useDeferredValue, useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CalendarDays, FileText, Globe2, NotebookPen, Search, Settings2, X } from 'lucide-react';
import { appRegistry, appList } from '../apps/registry';
import { getAllRecords, initializeDatabase } from '../lib/db';
import { usePreferences } from '../context/PreferencesContext';
import { useModalFocus } from '../hooks/useModalFocus';
import type { AppId, AppLaunchIntent, CalendarEvent, FileNode, Note, WebsiteShortcut } from '../types';
import type { LucideIcon } from 'lucide-react';

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  appId: AppId;
  icon: LucideIcon;
  intent?: AppLaunchIntent;
}

interface SearchData {
  files: FileNode[];
  notes: Note[];
  events: CalendarEvent[];
  websites: WebsiteShortcut[];
}

const settingsResults: Omit<SearchResult, 'icon'>[] = [
  { id: 'settings-appearance', title: 'Appearance settings', subtitle: 'Theme, accent, color mode, and wallpaper', appId: 'settings', intent: { section: 'appearance' } },
  { id: 'settings-system', title: 'Accessibility & performance', subtitle: 'Reduced motion, performance mode, and desktop behavior', appId: 'settings', intent: { section: 'system' } },
  { id: 'settings-data', title: 'Storage & backups', subtitle: 'Export, restore, and browser storage controls', appId: 'settings', intent: { section: 'data' } },
];

export function SearchPalette({ onClose, onOpen }: { onClose: () => void; onOpen: (appId: AppId, intent?: AppLaunchIntent) => void }) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [data, setData] = useState<SearchData>({ files: [], notes: [], events: [], websites: [] });
  const [selected, setSelected] = useState(0);
  const { preferences } = usePreferences();
  const systemReducedMotion = useReducedMotion();
  const dialogRef = useModalFocus<HTMLElement>(true, onClose);

  useEffect(() => {
    let active = true;
    initializeDatabase()
      .then(() => Promise.all([
        getAllRecords<FileNode>('files'),
        getAllRecords<Note>('notes'),
        getAllRecords<CalendarEvent>('events'),
        getAllRecords<WebsiteShortcut>('websites'),
      ]))
      .then(([files, notes, events, websites]) => { if (active) setData({ files, notes, events, websites }); })
      .catch(() => {
        // Apps surface detailed storage errors; global search still searches built-in apps and actions.
      });
    return () => { active = false; };
  }, []);

  const results = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase();
    const apps: SearchResult[] = appList.filter((app) => !preferences.removedApps.includes(app.id) && (!normalized || `${app.title} ${app.description}`.toLowerCase().includes(normalized))).map((app) => ({ id: app.id, title: app.title, subtitle: app.description, appId: app.id, icon: app.icon }));
    if (!normalized) return apps.slice(0, 7);
    const actions = settingsResults.filter((result) => `${result.title} ${result.subtitle}`.toLowerCase().includes(normalized)).map((result) => ({ ...result, icon: Settings2 }));
    const websites: SearchResult[] = data.websites.filter((website) => `${website.name} ${website.url}`.toLowerCase().includes(normalized)).slice(0, 4).map((website) => ({ id: website.id, title: website.name, subtitle: 'Website shortcut · open in NOVA Browser', appId: 'browser', icon: Globe2, intent: { url: website.url } }));
    const files: SearchResult[] = data.files.filter((file) => !file.trashed && `${file.name} ${file.content.slice(0, 2_000)}`.toLowerCase().includes(normalized)).slice(0, 4).map((file) => ({ id: file.id, title: file.name, subtitle: 'Virtual file · open this item in Files', appId: 'files', icon: FileText, intent: { recordId: file.id } }));
    const notes: SearchResult[] = data.notes.filter((note) => `${note.title} ${note.content.slice(0, 2_000)}`.toLowerCase().includes(normalized)).slice(0, 4).map((note) => ({ id: note.id, title: note.title || 'Untitled note', subtitle: 'Note · open this note', appId: 'notes', icon: NotebookPen, intent: { recordId: note.id } }));
    const events: SearchResult[] = data.events.filter((event) => `${event.title} ${event.details}`.toLowerCase().includes(normalized)).slice(0, 3).map((event) => ({ id: event.id, title: event.title, subtitle: `Calendar event · ${event.date}`, appId: 'calendar', icon: CalendarDays, intent: { recordId: event.id } }));
    return [...apps, ...websites, ...actions, ...files, ...notes, ...events].slice(0, 16);
  }, [deferredQuery, data, preferences.removedApps]);

  useEffect(() => setSelected(0), [query]);

  useEffect(() => {
    const option = document.getElementById(`search-result-${selected}`);
    if (typeof option?.scrollIntoView === 'function') option.scrollIntoView({ block: 'nearest' });
  }, [selected, results]);

  const choose = (result?: SearchResult) => {
    if (!result) return;
    onOpen(result.appId, result.intent);
    onClose();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setSelected((current) => results.length ? Math.min(current + 1, results.length - 1) : 0); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setSelected((current) => Math.max(current - 1, 0)); }
    if (event.key === 'Home') { event.preventDefault(); setSelected(0); }
    if (event.key === 'End') { event.preventDefault(); setSelected(results.length ? results.length - 1 : 0); }
    if (event.key === 'Enter') { event.preventDefault(); choose(results[selected]); }
  };

  return (
    <div className="search-overlay fixed inset-0 z-[11000] flex items-start justify-center bg-black/25 p-3 pt-[10vh] backdrop-blur-[2px]" onClick={onClose}>
      <motion.section
        ref={dialogRef}
        tabIndex={-1}
        className="glass-panel w-full max-w-xl overflow-hidden !rounded-[20px]"
        initial={systemReducedMotion || preferences.reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Global search"
      >
        <label className="flex items-center gap-3 border-b border-ink/[0.08] px-4">
          <Search size={19} className="accent-text shrink-0" />
          <span className="sr-only">Search apps, files, notes, events, and settings</span>
          <input className="h-14 min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted" placeholder="Search apps, files, notes, events, and settings…" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={onKeyDown} autoFocus role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls="search-results" aria-activedescendant={results[selected] ? `search-result-${selected}` : undefined} />
          <kbd className="hidden rounded-md border border-ink/10 px-1.5 py-1 text-[9px] text-muted sm:block">ESC</kbd>
          <button type="button" className="icon-button h-8 w-8 sm:hidden" onClick={onClose} aria-label="Close search"><X size={16} /></button>
        </label>
        <div id="search-results" className="search-results app-scroll max-h-[55vh] overflow-y-auto p-2" role="listbox" aria-label="Search results" aria-busy={query !== deferredQuery}>
          <p className="eyebrow px-2 py-2">{query ? `${results.length} RESULTS` : 'QUICK LAUNCH'}</p>
          {results.map((result, index) => {
            const Icon = result.icon;
            return <button id={`search-result-${index}`} role="option" tabIndex={-1} aria-selected={selected === index} key={`${result.appId}-${result.id}`} className={`flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors ${selected === index ? 'bg-ink/[0.075]' : 'hover:bg-ink/[0.04]'}`} onMouseEnter={() => setSelected(index)} onClick={() => choose(result)}><span className="accent-surface flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"><Icon size={17} /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium text-ink/85">{result.title}</span><span className="mt-0.5 block truncate text-[10px] text-muted">{result.subtitle}</span></span><span className="hidden text-[9px] uppercase tracking-wider text-muted sm:inline">{appRegistry[result.appId].title}</span></button>;
          })}
          {results.length === 0 && <div className="px-5 py-10 text-center"><p className="text-sm text-ink/60">Nothing found in this orbit</p><p className="mt-2 text-xs text-muted">Try an app name, setting, note, file, or event.</p></div>}
        </div>
        <div className="flex items-center gap-4 border-t border-ink/[0.06] px-4 py-2.5 text-[9px] text-muted"><span className="hidden sm:inline">↑↓ Navigate</span><span className="hidden sm:inline">↵ Open</span><span className="ml-auto">Local search only</span></div>
      </motion.section>
    </div>
  );
}
