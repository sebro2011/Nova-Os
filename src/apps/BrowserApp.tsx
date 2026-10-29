import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Bookmark, Clock3, ExternalLink, Globe2, Home,
  LockKeyhole, MoreHorizontal, Plus, RotateCw, Search, ShieldCheck, Star, Trash2, X,
} from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { clearStore, deleteRecord, getAllRecords, initializeDatabase, putRecord } from '../lib/db';
import { displayUrl, getEmbeddingRestriction, getYouTubeEmbedUrl, normalizeWebUrl } from '../lib/browser';
import { createId, errorMessage, formatDateTime } from '../lib/utils';
import type { BrowserBookmark, BrowserHistoryEntry } from '../types';

const HOME_URL = 'nova://home';
const quickLinks = [
  { title: 'Wikipedia', url: 'https://www.wikipedia.org', description: 'Explore human knowledge' },
  { title: 'MDN Web Docs', url: 'https://developer.mozilla.org', description: 'Build for the open web' },
  { title: 'NASA', url: 'https://www.nasa.gov', description: 'Discover beyond Earth' },
];

interface BrowserTab {
  id: string;
  url: string;
  stack: string[];
  index: number;
  loading: boolean;
}

function newBrowserTab(): BrowserTab {
  return { id: createId('tab'), url: HOME_URL, stack: [HOME_URL], index: 0, loading: false };
}

export default function BrowserApp() {
  const [tabs, setTabs] = useState<BrowserTab[]>(() => [newBrowserTab()]);
  const [activeTabId, setActiveTabId] = useState(() => tabs[0].id);
  const [address, setAddress] = useState('');
  const [frameKey, setFrameKey] = useState(0);
  const [error, setError] = useState('');
  const [panel, setPanel] = useState<'history' | 'bookmarks' | 'menu' | null>(null);
  const [history, setHistory] = useState<BrowserHistoryEntry[]>([]);
  const [bookmarks, setBookmarks] = useState<BrowserBookmark[]>([]);
  const { notify } = useNotifications();
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
  const embeddingRestriction = activeTab.url === HOME_URL ? null : getEmbeddingRestriction(activeTab.url);
  const youtubeEmbedUrl = activeTab.url === HOME_URL ? null : getYouTubeEmbedUrl(activeTab.url);

  const loadStorage = useCallback(async () => {
    try {
      await initializeDatabase();
      const [historyRecords, bookmarkRecords] = await Promise.all([
        getAllRecords<BrowserHistoryEntry>('history'),
        getAllRecords<BrowserBookmark>('bookmarks'),
      ]);
      setHistory(historyRecords.sort((a, b) => b.visitedAt.localeCompare(a.visitedAt)).slice(0, 50));
      setBookmarks(bookmarkRecords.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    } catch {
      // Navigation remains available when bookmarks or history storage is unavailable.
    }
  }, []);

  useEffect(() => {
    void loadStorage();
    const refresh = () => void loadStorage();
    window.addEventListener('nova:data-imported', refresh);
    return () => window.removeEventListener('nova:data-imported', refresh);
  }, [loadStorage]);

  useEffect(() => {
    setAddress(activeTab.url === HOME_URL ? '' : activeTab.url);
    setError('');
  }, [activeTab.url, activeTabId]);

  const updateActiveTab = (patch: Partial<BrowserTab>) => {
    setTabs((current) => current.map((tab) => tab.id === activeTab.id ? { ...tab, ...patch } : tab));
  };

  const navigate = async (input: string) => {
    try {
      const url = input === HOME_URL ? HOME_URL : normalizeWebUrl(input);
      const nextStack = [...activeTab.stack.slice(0, activeTab.index + 1), url].slice(-50);
      setError('');
      setPanel(null);
      setFrameKey((current) => current + 1);
      updateActiveTab({ url, stack: nextStack, index: nextStack.length - 1, loading: url !== HOME_URL && !getEmbeddingRestriction(url) });
      if (url !== HOME_URL) {
        const entry: BrowserHistoryEntry = { id: createId('history'), url, title: displayUrl(url), visitedAt: new Date().toISOString() };
        try {
          await putRecord('history', entry);
          setHistory((current) => [entry, ...current].slice(0, 50));
        } catch {
          // Browsing does not depend on history persistence.
        }
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Invalid address.');
    }
  };

  const go = (index: number) => {
    const url = activeTab.stack[index];
    if (!url) return;
    setFrameKey((current) => current + 1);
    setError('');
    updateActiveTab({ url, index, loading: url !== HOME_URL && !getEmbeddingRestriction(url) });
  };

  const reload = () => {
    setFrameKey((current) => current + 1);
    updateActiveTab({ loading: activeTab.url !== HOME_URL && !embeddingRestriction });
  };

  const addTab = () => {
    if (tabs.length >= 8) {
      notify({ title: 'Tab limit reached', message: 'NOVA keeps up to eight lightweight session tabs. Close a tab before opening another.', tone: 'info' });
      return;
    }
    const tab = newBrowserTab();
    setTabs((current) => [...current, tab]);
    setActiveTabId(tab.id);
    setPanel(null);
  };

  const closeTab = (id: string) => {
    const index = tabs.findIndex((tab) => tab.id === id);
    const remaining = tabs.filter((tab) => tab.id !== id);
    if (!remaining.length) {
      const tab = newBrowserTab();
      setTabs([tab]);
      setActiveTabId(tab.id);
      return;
    }
    setTabs(remaining);
    if (id === activeTabId) setActiveTabId(remaining[Math.max(0, index - 1)].id);
  };

  const openExternally = () => {
    if (activeTab.url === HOME_URL) return;
    const opened = window.open(activeTab.url, '_blank', 'noopener,noreferrer');
    if (opened) opened.opener = null;
    else notify({ title: 'Pop-up blocked', message: 'Allow pop-ups for NOVA or copy the address into your browser.', tone: 'warning' });
  };

  const activeBookmark = bookmarks.find((bookmark) => bookmark.url === activeTab.url);
  const toggleBookmark = async () => {
    if (activeTab.url === HOME_URL) return;
    try {
      if (activeBookmark) {
        await deleteRecord('bookmarks', activeBookmark.id);
        setBookmarks((current) => current.filter((bookmark) => bookmark.id !== activeBookmark.id));
      } else {
        const bookmark: BrowserBookmark = { id: createId('bookmark'), url: activeTab.url, title: displayUrl(activeTab.url), createdAt: new Date().toISOString() };
        await putRecord('bookmarks', bookmark);
        setBookmarks((current) => [...current, bookmark]);
      }
    } catch (caught) {
      notify({ title: 'Bookmark not saved', message: errorMessage(caught), tone: 'error' });
    }
  };

  const removeBookmark = async (bookmark: BrowserBookmark) => {
    try {
      await deleteRecord('bookmarks', bookmark.id);
      setBookmarks((current) => current.filter((item) => item.id !== bookmark.id));
    } catch (caught) {
      notify({ title: 'Bookmark not removed', message: errorMessage(caught), tone: 'error' });
    }
  };

  const clearHistory = async () => {
    if (!window.confirm('Clear all NOVA Browser history stored in this browser? Bookmarks will not be affected.')) return;
    try {
      await clearStore('history');
      setHistory([]);
    } catch (caught) {
      notify({ title: 'History not cleared', message: errorMessage(caught), tone: 'error' });
    }
  };

  return (
    <div className="flex h-full flex-col bg-[var(--app-bg)]">
      <div className="browser-tabbar flex h-10 shrink-0 items-center gap-1 border-b border-ink/[0.06] bg-black/5 px-2 pt-1">
        <div className="app-scroll flex min-w-0 flex-1 gap-1 overflow-x-auto" role="tablist" aria-label="Browser tabs">
          {tabs.map((tab) => <div key={tab.id} className={`flex h-8 min-w-28 max-w-48 flex-1 items-center rounded-t-lg border-b-2 ${tab.id === activeTab.id ? 'border-nova-blue bg-ink/[0.075]' : 'border-transparent text-ink/35 hover:bg-ink/[0.035]'}`}>
            <button className="flex h-full min-w-0 flex-1 items-center gap-2 px-2.5 text-left" onClick={() => { setActiveTabId(tab.id); setPanel(null); }} role="tab" aria-selected={tab.id === activeTab.id} aria-label={tab.url === HOME_URL ? 'New tab' : displayUrl(tab.url)}>
              {tab.url === HOME_URL ? <Home size={12} className="shrink-0" /> : <Globe2 size={12} className="shrink-0" />}
              <span className="truncate text-[10px] text-ink/55">{tab.url === HOME_URL ? 'New tab' : displayUrl(tab.url)}</span>
            </button>
            <button className="mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink/25 hover:bg-ink/[0.07] hover:text-ink/60" onClick={() => closeTab(tab.id)} aria-label={`Close ${tab.url === HOME_URL ? 'new tab' : displayUrl(tab.url)}`}><X size={11} /></button>
          </div>)}
        </div>
        <button className="icon-button h-7 w-7 shrink-0" onClick={addTab} aria-label="New browser tab" title="New tab"><Plus size={15} /></button>
      </div>

      <div className="relative flex shrink-0 flex-wrap items-center gap-0.5 border-b border-ink/[0.06] bg-ink/[0.02] p-2 sm:flex-nowrap sm:gap-1">
        <button className="icon-button h-8 w-8" onClick={() => go(activeTab.index - 1)} disabled={activeTab.index <= 0} aria-label="Back"><ArrowLeft size={15} /></button>
        <button className="icon-button h-8 w-8" onClick={() => go(activeTab.index + 1)} disabled={activeTab.index >= activeTab.stack.length - 1} aria-label="Forward"><ArrowRight size={15} /></button>
        <button className="icon-button h-8 w-8" onClick={reload} aria-label="Reload"><RotateCw size={14} className={activeTab.loading ? 'animate-spin' : ''} /></button>
        <button className="icon-button hidden h-8 w-8 sm:flex" onClick={() => void navigate(HOME_URL)} aria-label="NOVA Browser home"><Home size={14} /></button>
        <form className="relative order-first mb-1 w-full min-w-0 flex-none sm:order-none sm:mx-1 sm:mb-0 sm:w-auto sm:flex-1" onSubmit={(event) => { event.preventDefault(); void navigate(address); }}>
          <LockKeyhole size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-300/50" />
          <input className="nova-input !min-h-8 !rounded-full !py-1.5 !pl-8 !pr-9 !text-[11px]" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Search or enter an HTTPS address" aria-label="Address and search bar" autoCapitalize="off" autoComplete="off" spellCheck={false} />
          {address && <button type="button" className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-ink/30 hover:bg-ink/[0.06]" onClick={() => setAddress('')} aria-label="Clear address"><X size={12} /></button>}
        </form>
        <span className="flex-1 sm:hidden" aria-hidden="true" />
        <button className={`icon-button h-8 w-8 ${activeBookmark ? 'text-amber-300' : ''}`} onClick={() => void toggleBookmark()} disabled={activeTab.url === HOME_URL} aria-label={activeBookmark ? 'Remove bookmark' : 'Bookmark this page'} title={activeBookmark ? 'Remove bookmark' : 'Bookmark'}><Star size={15} fill={activeBookmark ? 'currentColor' : 'none'} /></button>
        <button className="icon-button hidden h-8 w-8 sm:flex" data-active={panel === 'bookmarks'} onClick={() => setPanel((current) => current === 'bookmarks' ? null : 'bookmarks')} aria-label="Show bookmarks" aria-expanded={panel === 'bookmarks'}><Bookmark size={14} /></button>
        <button className="icon-button h-8 w-8" data-active={panel === 'history'} onClick={() => setPanel((current) => current === 'history' ? null : 'history')} aria-label="Browsing history" aria-expanded={panel === 'history'}><Clock3 size={15} /></button>
        <button className="icon-button h-8 w-8 sm:hidden" data-active={panel === 'menu'} onClick={() => setPanel((current) => current === 'menu' ? null : 'menu')} aria-label="Browser menu" aria-expanded={panel === 'menu'}><MoreHorizontal size={17} /></button>
        <button className="icon-button hidden h-8 w-8 md:flex" onClick={openExternally} disabled={activeTab.url === HOME_URL} aria-label="Open in a new browser tab" title="Open externally"><ExternalLink size={14} /></button>
        {activeTab.loading && <span className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden"><span className="block h-full w-1/2 animate-pulse bg-gradient-to-r from-transparent via-nova-blue to-transparent" /></span>}
      </div>
      {error && <div className="flex shrink-0 items-center gap-2 border-b border-red-300/10 bg-red-300/[0.06] px-3 py-2 text-[11px] text-red-200" role="alert"><ShieldCheck size={13} />{error}</div>}

      <div className="relative min-h-0 flex-1">
        {activeTab.url === HOME_URL ? <div className="app-scroll h-full overflow-y-auto bg-[radial-gradient(ellipse_at_top,rgba(var(--accent-rgb),0.08),transparent_55%)] p-5 sm:p-8">
          <div className="mx-auto max-w-2xl pt-[3vh] text-center">
            <span className="accent-surface mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"><Globe2 size={27} /></span>
            <p className="eyebrow mt-5">NOVA BROWSER</p>
            <h2 className="mt-2 text-2xl font-light tracking-tight text-ink/85">Where to next, explorer?</h2>
            <form className="relative mx-auto mt-6 max-w-lg" onSubmit={(event) => { event.preventDefault(); void navigate(address); }}><Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/30" /><input className="nova-input !h-12 !rounded-2xl !pl-11 !pr-24" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Search the web or enter a URL" aria-label="Search the web" /><button className="nova-button absolute right-1.5 top-1/2 h-9 min-h-9 -translate-y-1/2 px-3">Go</button></form>
            <div className="mt-7 grid gap-3 sm:grid-cols-3">{quickLinks.map((link) => <button key={link.url} className="nova-card p-4 text-left transition-colors hover:border-[rgba(var(--accent-rgb),0.25)] hover:bg-ink/[0.05]" onClick={() => void navigate(link.url)}><Globe2 size={17} className="accent-text" /><p className="mt-3 text-xs font-semibold text-ink/75">{link.title}</p><p className="mt-1 text-[10px] text-ink/30">{link.description}</p></button>)}</div>
            {bookmarks.length > 0 && <div className="mt-6 text-left"><div className="flex items-center gap-2"><Bookmark size={13} className="accent-text" /><h3 className="text-[11px] font-medium text-ink/55">Your bookmarks</h3></div><div className="mt-2 flex gap-2 overflow-x-auto pb-2 app-scroll">{bookmarks.map((bookmark) => <button key={bookmark.id} className="nova-card flex shrink-0 items-center gap-2 px-3 py-2 text-[10px] text-ink/50 hover:bg-ink/[0.05]" onClick={() => void navigate(bookmark.url)}><Star size={11} className="text-amber-300/70" />{bookmark.title}</button>)}</div></div>}
            <div className="mx-auto mt-6 max-w-lg rounded-xl border border-ink/[0.06] bg-black/5 p-3.5 text-left"><div className="flex items-center gap-2 text-[11px] font-medium text-ink/55"><ShieldCheck size={14} className="text-emerald-300/60" /> Honest browser boundaries</div><p className="mt-2 text-[10px] leading-5 text-ink/30">NOVA uses your browser’s engine and a sandboxed frame. YouTube video links use the official embed player. Known blocked pages use an external-only screen; other sites may also require “Open externally.” NOVA is not a VPN or a privacy proxy.</p></div>
          </div>
        </div> : embeddingRestriction ? <div className="app-scroll h-full overflow-y-auto bg-[radial-gradient(ellipse_at_top,rgba(var(--accent-rgb),0.08),transparent_55%)] p-5" role="status">
          <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center py-6 text-center">
            <span className="accent-surface flex h-14 w-14 items-center justify-center rounded-2xl"><ExternalLink size={25} /></span>
            <p className="eyebrow mt-5">EXTERNAL-ONLY PAGE</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink/85">Open this site in a normal browser tab</h2>
            <p className="mt-3 text-xs leading-6 text-ink/50">{embeddingRestriction}</p>
            <p className="mt-2 text-[11px] leading-5 text-ink/35">NOVA cannot override another site’s X-Frame-Options or Content-Security-Policy. Instead of showing a broken frame, NOVA can hand the address to your browser.</p>
            <p className="mt-4 line-clamp-2 max-w-full break-all rounded-lg bg-ink/[0.035] px-3 py-2 text-[10px] text-ink/30" title={activeTab.url}>{activeTab.url}</p>
            <div className="mt-6 flex w-full flex-col justify-center gap-2 sm:w-auto sm:flex-row">
              <button className="nova-button" onClick={openExternally}><ExternalLink size={16} /> Open externally</button>
              <button className="nova-button nova-button-secondary" onClick={() => void navigate(HOME_URL)}><Home size={15} /> NOVA Browser home</button>
            </div>
          </div>
        </div> : <>
          <iframe
            key={`${activeTab.id}-${activeTab.url}-${frameKey}`}
            src={youtubeEmbedUrl ?? activeTab.url}
            title={youtubeEmbedUrl ? 'YouTube video player' : `NOVA Browser — ${displayUrl(activeTab.url)}`}
            className="h-full w-full border-0 bg-white"
            sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-downloads"
            referrerPolicy={youtubeEmbedUrl ? 'strict-origin-when-cross-origin' : 'no-referrer'}
            allow={youtubeEmbedUrl ? 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share' : undefined}
            allowFullScreen={Boolean(youtubeEmbedUrl)}
            onLoad={() => setTabs((current) => current.map((tab) => tab.id === activeTab.id ? { ...tab, loading: false } : tab))}
          />
          {!youtubeEmbedUrl && <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-2"><div className="pointer-events-auto flex max-w-full items-center gap-2 rounded-full border border-ink/10 bg-[var(--editor-bg)] px-3 py-1.5 text-[9px] text-ink/40 shadow-lg backdrop-blur-md"><span className="truncate">If this page is blank, the site may block embedded viewing.</span><button className="pointer-events-auto flex shrink-0 items-center gap-1 text-nova-blue hover:text-ink" onClick={openExternally}>Open externally <ExternalLink size={10} /></button></div></div>}
        </>}

        {panel && <aside className="absolute inset-y-0 right-0 z-20 flex w-[min(330px,92%)] flex-col border-l border-ink/[0.08] bg-[var(--editor-bg)] shadow-2xl">
          <div className="flex items-center border-b border-ink/[0.06] p-3">
            <div className="flex-1">
              <p className="eyebrow">{panel === 'history' ? 'LOCAL HISTORY' : panel === 'bookmarks' ? 'SAVED PAGES' : 'BROWSER MENU'}</p>
              <h3 className="mt-1 text-xs font-semibold">{panel === 'history' ? 'Recent addresses' : panel === 'bookmarks' ? 'Bookmarks' : 'More actions'}</h3>
            </div>
            {panel === 'history' && <button className="icon-button" onClick={() => void clearHistory()} disabled={!history.length} aria-label="Clear browsing history"><Trash2 size={14} /></button>}
            <button className="icon-button" onClick={() => setPanel(null)} aria-label={`Close ${panel}`}><X size={15} /></button>
          </div>
          <div className="app-scroll min-h-0 flex-1 overflow-y-auto p-2">
            {panel === 'menu' ? <nav className="space-y-1" aria-label="Additional browser actions">
              <button className="flex w-full items-center gap-3 rounded-lg p-3 text-left text-xs text-ink/65 hover:bg-ink/[0.04]" onClick={() => void navigate(HOME_URL)}><Home size={16} className="accent-text" />NOVA Browser home</button>
              <button className="flex w-full items-center gap-3 rounded-lg p-3 text-left text-xs text-ink/65 hover:bg-ink/[0.04]" onClick={() => setPanel('bookmarks')}><Bookmark size={16} className="accent-text" />Bookmarks<span className="ml-auto text-[10px] text-ink/30">{bookmarks.length}</span></button>
              <button className="flex w-full items-center gap-3 rounded-lg p-3 text-left text-xs text-ink/65 hover:bg-ink/[0.04]" onClick={() => { setPanel(null); openExternally(); }} disabled={activeTab.url === HOME_URL}><ExternalLink size={16} className="accent-text" />Open in a new browser tab</button>
            </nav> : panel === 'history' ? <>
              {history.map((entry) => <button key={entry.id} className="w-full rounded-lg p-2.5 text-left hover:bg-ink/[0.04]" onClick={() => void navigate(entry.url)}><span className="block truncate text-xs text-ink/65">{entry.title}</span><span className="mt-1 block text-[9px] text-ink/25">{formatDateTime(entry.visitedAt)}</span></button>)}
              {!history.length && <p className="p-8 text-center text-xs text-ink/30">No local history yet.</p>}
            </> : <>
              {bookmarks.map((bookmark) => <div key={bookmark.id} className="mb-1 flex items-center rounded-lg hover:bg-ink/[0.04]"><button className="min-w-0 flex-1 p-2.5 text-left" onClick={() => void navigate(bookmark.url)}><span className="block truncate text-xs text-ink/65">{bookmark.title}</span><span className="mt-1 block truncate text-[9px] text-ink/25">{bookmark.url}</span></button><button className="icon-button mr-1 h-7 w-7" onClick={() => void removeBookmark(bookmark)} aria-label={`Remove bookmark ${bookmark.title}`}><Trash2 size={12} /></button></div>)}
              {!bookmarks.length && <div className="p-8 text-center"><Star size={22} className="mx-auto text-ink/15" /><p className="mt-3 text-xs text-ink/30">No bookmarks yet.</p><p className="mt-1.5 text-[10px] text-ink/20">Use the star in the address bar to save a page.</p></div>}
            </>}
          </div>
          {panel !== 'menu' && <p className="border-t border-ink/[0.055] p-3 text-[9px] leading-4 text-ink/25">{panel === 'history' ? 'Only submitted addresses are recorded. History is stored locally and can be cleared here.' : 'Bookmarks persist in IndexedDB and are included in NOVA JSON backups.'}</p>}
        </aside>}
      </div>
    </div>
  );
}
