import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Pin, Search, Settings2 } from 'lucide-react';
import { appList, appRegistry, type AppDefinition } from '../apps/registry';
import { NovaLogo } from './NovaLogo';
import { usePreferences } from '../context/PreferencesContext';
import { useModalFocus } from '../hooks/useModalFocus';
import type { AppId } from '../types';

export function StartMenu({ onClose, onOpen }: { onClose: () => void; onOpen: (appId: AppId) => void }) {
  const [query, setQuery] = useState('');
  const { preferences } = usePreferences();
  const systemReducedMotion = useReducedMotion();
  const dialogRef = useModalFocus<HTMLElement>(true, onClose);
  const apps = useMemo(() => appList
    .filter((app) => `${app.title} ${app.description}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => Number(preferences.dockPinned.includes(b.id)) - Number(preferences.dockPinned.includes(a.id))), [query, preferences.dockPinned]);
  const featured = useMemo(() => [...preferences.recentApps, ...preferences.dockPinned]
    .filter((id, index, all) => all.indexOf(id) === index)
    .map((id) => appRegistry[id])
    .slice(0, 5), [preferences.recentApps, preferences.dockPinned]);

  const appButton = (app: AppDefinition) => {
    const Icon = app.icon;
    const pinned = preferences.dockPinned.includes(app.id);
    return (
      <button key={app.id} className="group flex items-center gap-3 rounded-xl border border-transparent p-2.5 text-left transition-colors hover:border-ink/[0.07] hover:bg-ink/[0.05]" onClick={() => { onOpen(app.id); onClose(); }}>
        <span className="accent-surface flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105"><Icon size={18} /></span>
        <span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium text-ink/85">{app.title}</span><span className="mt-0.5 block truncate text-[10px] text-muted">{app.category}</span></span>
        {pinned && <Pin size={11} className="shrink-0 text-muted" aria-label="Pinned" />}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-[10000]" onClick={onClose}>
      <motion.section
        ref={dialogRef}
        tabIndex={-1}
        className="glass-panel shell-popover launcher-panel absolute left-3 top-[52px] flex max-h-[calc(100dvh-140px)] w-[min(390px,calc(100vw-24px))] flex-col overflow-hidden !rounded-[22px]"
        initial={systemReducedMotion || preferences.reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.16 }}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="NOVA app launcher"
      >
        <div className="p-4 pb-3">
          <label className="relative block">
            <span className="sr-only">Search apps</span>
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input className="nova-input !pl-9" placeholder="Find an app…" value={query} onChange={(event) => setQuery(event.target.value)} autoFocus />
          </label>
        </div>
        <div className="app-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          {!query && featured.length > 0 && <><p className="eyebrow px-2 py-2">RECENT & PINNED</p><div className="grid grid-cols-2 gap-1.5">{featured.map(appButton)}</div><div className="my-2 h-px bg-ink/[0.06]" /></>}
          <p className="eyebrow px-2 py-2">{query ? 'MATCHING APPS' : 'ALL APPS · PINNED FIRST'}</p>
          <div className="grid grid-cols-2 gap-1.5">{apps.map(appButton)}</div>
          {apps.length === 0 && <p className="p-8 text-center text-xs text-muted">No apps match “{query}”.</p>}
        </div>
        <div className="flex items-center gap-3 border-t border-ink/[0.07] bg-black/10 p-3">
          <NovaLogo size="sm" />
          <div className="min-w-0 flex-1"><p className="text-xs font-medium text-ink/75">Local Explorer</p><p className="text-[10px] text-muted">Private browser session</p></div>
          <button className="icon-button" onClick={() => { onOpen('settings'); onClose(); }} aria-label="Open Settings"><Settings2 size={16} /></button>
        </div>
      </motion.section>
    </div>
  );
}
