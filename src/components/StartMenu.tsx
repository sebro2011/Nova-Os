import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Search, Settings2 } from 'lucide-react';
import { appList } from '../apps/registry';
import { NovaLogo } from './NovaLogo';
import { usePreferences } from '../context/PreferencesContext';
import type { AppId } from '../types';

export function StartMenu({ onClose, onOpen }: { onClose: () => void; onOpen: (appId: AppId) => void }) {
  const [query, setQuery] = useState('');
  const { preferences } = usePreferences();
  const systemReducedMotion = useReducedMotion();
  const apps = useMemo(() => appList.filter((app) => `${app.title} ${app.description}`.toLowerCase().includes(query.toLowerCase())), [query]);

  return (
    <div className="fixed inset-0 z-[10000]" onClick={onClose}>
      <motion.section
        className="glass-panel absolute left-3 top-[52px] flex max-h-[calc(100dvh-140px)] w-[min(390px,calc(100vw-24px))] flex-col overflow-hidden !rounded-[22px]"
        initial={systemReducedMotion || preferences.reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.16 }}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label="NOVA app launcher"
      >
        <div className="p-4 pb-3">
          <label className="relative block">
            <span className="sr-only">Search apps</span>
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" />
            <input className="nova-input !pl-9" placeholder="Find an app…" value={query} onChange={(event) => setQuery(event.target.value)} autoFocus />
          </label>
        </div>
        <div className="app-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          <p className="eyebrow px-2 py-2">YOUR APPS</p>
          <div className="grid grid-cols-2 gap-1.5">
            {apps.map((app) => {
              const Icon = app.icon;
              return (
                <button key={app.id} className="group flex items-center gap-3 rounded-xl border border-transparent p-2.5 text-left transition-colors hover:border-ink/[0.07] hover:bg-ink/[0.05]" onClick={() => { onOpen(app.id); onClose(); }}>
                  <span className="accent-surface flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105"><Icon size={18} /></span>
                  <span className="min-w-0"><span className="block truncate text-xs font-medium text-ink/85">{app.title}</span><span className="mt-0.5 block truncate text-[10px] text-ink/35">{app.category}</span></span>
                </button>
              );
            })}
          </div>
          {apps.length === 0 && <p className="p-8 text-center text-xs text-ink/40">No apps match “{query}”.</p>}
        </div>
        <div className="flex items-center gap-3 border-t border-ink/[0.07] bg-black/10 p-3">
          <NovaLogo size="sm" />
          <div className="min-w-0 flex-1"><p className="text-xs font-medium text-ink/75">Local Explorer</p><p className="text-[10px] text-ink/35">Private browser session</p></div>
          <button className="icon-button" onClick={() => { onOpen('settings'); onClose(); }} aria-label="Open Settings"><Settings2 size={16} /></button>
        </div>
      </motion.section>
    </div>
  );
}
