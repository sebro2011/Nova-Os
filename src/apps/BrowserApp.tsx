import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Clock3, ExternalLink, Globe2, Home, LockKeyhole, RotateCw, Search, ShieldCheck, X } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { getAllRecords, initializeDatabase, putRecord } from '../lib/db';
import { displayUrl, normalizeWebUrl } from '../lib/browser';
import { createId, formatDateTime } from '../lib/utils';
import type { BrowserHistoryEntry } from '../types';

const HOME_URL = 'nova://home';
const quickLinks = [
  { title: 'Wikipedia', url: 'https://www.wikipedia.org', description: 'Explore human knowledge' },
  { title: 'MDN Web Docs', url: 'https://developer.mozilla.org', description: 'Build for the open web' },
  { title: 'NASA', url: 'https://www.nasa.gov', description: 'Discover beyond Earth' },
];

export default function BrowserApp() {
  const [currentUrl, setCurrentUrl] = useState(HOME_URL);
  const [address, setAddress] = useState('');
  const [stack, setStack] = useState<string[]>([HOME_URL]);
  const [stackIndex, setStackIndex] = useState(0);
  const [frameKey, setFrameKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<BrowserHistoryEntry[]>([]);
  const { notify } = useNotifications();

  const loadHistory = useCallback(async () => {
    try {
      await initializeDatabase();
      const records = await getAllRecords<BrowserHistoryEntry>('history');
      setHistory(records.sort((a, b) => b.visitedAt.localeCompare(a.visitedAt)).slice(0, 30));
    } catch {
      // Navigation remains available when history storage is unavailable.
    }
  }, []);

  useEffect(() => {
    void loadHistory();
    const refresh = () => void loadHistory();
    window.addEventListener('nova:data-imported', refresh);
    return () => window.removeEventListener('nova:data-imported', refresh);
  }, [loadHistory]);

  const navigate = async (input: string, addToStack = true) => {
    try {
      const url = input === HOME_URL ? HOME_URL : normalizeWebUrl(input);
      setError('');
      setCurrentUrl(url);
      setAddress(url === HOME_URL ? '' : url);
      setLoading(url !== HOME_URL);
      setFrameKey((current) => current + 1);
      setShowHistory(false);
      if (addToStack) {
        const nextStack = [...stack.slice(0, stackIndex + 1), url].slice(-50);
        setStack(nextStack);
        setStackIndex(nextStack.length - 1);
      }
      if (url !== HOME_URL) {
        const entry: BrowserHistoryEntry = { id: createId('history'), url, title: displayUrl(url), visitedAt: new Date().toISOString() };
        try {
          await putRecord('history', entry);
          setHistory((current) => [entry, ...current].slice(0, 30));
        } catch {
          // Browsing does not depend on history persistence.
        }
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Invalid address.');
    }
  };

  const go = (index: number) => {
    const url = stack[index];
    if (!url) return;
    setStackIndex(index);
    setCurrentUrl(url);
    setAddress(url === HOME_URL ? '' : url);
    setLoading(url !== HOME_URL);
    setFrameKey((current) => current + 1);
    setError('');
  };

  const openExternally = () => {
    if (currentUrl === HOME_URL) return;
    const opened = window.open(currentUrl, '_blank', 'noopener,noreferrer');
    if (opened) opened.opener = null;
    else notify({ title: 'Pop-up blocked', message: 'Allow pop-ups for NOVA or copy the address into your browser.', tone: 'warning' });
  };

  return (
    <div className="flex h-full flex-col bg-[#090d18]">
      <div className="flex shrink-0 items-center gap-1 border-b border-white/[0.06] bg-white/[0.02] p-2">
        <button className="icon-button h-8 w-8" onClick={() => go(stackIndex - 1)} disabled={stackIndex <= 0} aria-label="Back"><ArrowLeft size={15} /></button>
        <button className="icon-button h-8 w-8" onClick={() => go(stackIndex + 1)} disabled={stackIndex >= stack.length - 1} aria-label="Forward"><ArrowRight size={15} /></button>
        <button className="icon-button h-8 w-8" onClick={() => currentUrl === HOME_URL ? setFrameKey((key) => key + 1) : void navigate(currentUrl)} aria-label="Reload"><RotateCw size={14} className={loading ? 'animate-spin' : ''} /></button>
        <button className="icon-button h-8 w-8" onClick={() => void navigate(HOME_URL)} aria-label="NOVA Browser home"><Home size={14} /></button>
        <form className="relative mx-1 min-w-0 flex-1" onSubmit={(event) => { event.preventDefault(); void navigate(address); }}>
          <LockKeyhole size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-300/50" />
          <input className="nova-input !min-h-8 !rounded-full !py-1.5 !pl-8 !pr-9 !text-[11px]" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Search or enter an HTTPS address" aria-label="Address and search bar" autoCapitalize="off" autoComplete="off" spellCheck={false} />
          {address && <button type="button" className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-white/30 hover:bg-white/[0.06]" onClick={() => setAddress('')} aria-label="Clear address"><X size={12} /></button>}
        </form>
        <button className="icon-button h-8 w-8" data-active={showHistory} onClick={() => setShowHistory((current) => !current)} aria-label="Browsing history" aria-expanded={showHistory}><Clock3 size={15} /></button>
        <button className="icon-button hidden h-8 w-8 sm:flex" onClick={openExternally} disabled={currentUrl === HOME_URL} aria-label="Open in a new browser tab" title="Open externally"><ExternalLink size={14} /></button>
      </div>
      {error && <div className="flex shrink-0 items-center gap-2 border-b border-red-300/10 bg-red-300/[0.06] px-3 py-2 text-[11px] text-red-200" role="alert"><ShieldCheck size={13} />{error}</div>}

      <div className="relative min-h-0 flex-1">
        {currentUrl === HOME_URL ? <div className="app-scroll h-full overflow-y-auto bg-[radial-gradient(ellipse_at_top,rgba(var(--accent-rgb),0.08),transparent_55%)] p-5 sm:p-8">
          <div className="mx-auto max-w-2xl pt-[4vh] text-center">
            <span className="accent-surface mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"><Globe2 size={27} /></span>
            <p className="eyebrow mt-5">NOVA BROWSER</p>
            <h2 className="mt-2 text-2xl font-light tracking-tight text-white/85">Where to next, explorer?</h2>
            <form className="relative mx-auto mt-6 max-w-lg" onSubmit={(event) => { event.preventDefault(); void navigate(address); }}><Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" /><input className="nova-input !h-12 !rounded-2xl !pl-11 !pr-24" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Search the web or enter a URL" aria-label="Search the web" /><button className="nova-button absolute right-1.5 top-1/2 h-9 min-h-9 -translate-y-1/2 px-3">Go</button></form>
            <div className="mt-7 grid gap-3 sm:grid-cols-3">{quickLinks.map((link) => <button key={link.url} className="nova-card p-4 text-left transition-colors hover:border-[rgba(var(--accent-rgb),0.25)] hover:bg-white/[0.05]" onClick={() => void navigate(link.url)}><Globe2 size={17} className="accent-text" /><p className="mt-3 text-xs font-semibold text-white/75">{link.title}</p><p className="mt-1 text-[10px] text-white/30">{link.description}</p></button>)}</div>
            <div className="mx-auto mt-7 max-w-lg rounded-xl border border-white/[0.06] bg-black/10 p-3.5 text-left"><div className="flex items-center gap-2 text-[11px] font-medium text-white/55"><ShieldCheck size={14} className="text-emerald-300/60" /> Honest browser boundaries</div><p className="mt-2 text-[10px] leading-5 text-white/30">NOVA uses your browser’s engine and a sandboxed frame. Many websites block embedding; use “Open externally” when that happens. NOVA is not a VPN or a privacy proxy.</p></div>
          </div>
        </div> : <>
          <iframe
            key={`${currentUrl}-${frameKey}`}
            src={currentUrl}
            title={`NOVA Browser — ${displayUrl(currentUrl)}`}
            className="h-full w-full border-0 bg-white"
            sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-downloads"
            referrerPolicy="no-referrer"
            onLoad={() => setLoading(false)}
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-2"><div className="pointer-events-auto flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-[#090d18]/90 px-3 py-1.5 text-[9px] text-white/40 shadow-lg backdrop-blur-md"><span className="truncate">If this page is blank, the site may block embedded viewing.</span><button className="pointer-events-auto flex shrink-0 items-center gap-1 text-nova-blue hover:text-white" onClick={openExternally}>Open externally <ExternalLink size={10} /></button></div></div>
        </>}

        {showHistory && <aside className="absolute inset-y-0 right-0 z-20 flex w-[min(320px,90%)] flex-col border-l border-white/[0.08] bg-[#0c101d]/[0.985] shadow-2xl"><div className="flex items-center border-b border-white/[0.06] p-3"><div className="flex-1"><p className="eyebrow">LOCAL HISTORY</p><h3 className="mt-1 text-xs font-semibold">Recent addresses</h3></div><button className="icon-button" onClick={() => setShowHistory(false)} aria-label="Close history"><X size={15} /></button></div><div className="app-scroll min-h-0 flex-1 overflow-y-auto p-2">{history.map((entry) => <button key={entry.id} className="w-full rounded-lg p-2.5 text-left hover:bg-white/[0.04]" onClick={() => void navigate(entry.url)}><span className="block truncate text-xs text-white/65">{entry.title}</span><span className="mt-1 block text-[9px] text-white/25">{formatDateTime(entry.visitedAt)}</span></button>)}{!history.length && <p className="p-8 text-center text-xs text-white/30">No local history yet.</p>}</div><p className="border-t border-white/[0.055] p-3 text-[9px] leading-4 text-white/25">Only addresses submitted in NOVA are recorded. Back/forward navigation is session-local.</p></aside>}
      </div>
    </div>
  );
}
