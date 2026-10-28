import { useMemo, useState } from 'react';
import { Check, Pin, PinOff, Search } from 'lucide-react';
import { appList } from './registry';
import { useLauncher } from '../context/LaunchContext';
import { usePreferences } from '../context/PreferencesContext';

const categories = ['All', 'Productivity', 'System', 'Internet', 'Media'] as const;

export default function AppCenterApp() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<typeof categories[number]>('All');
  const { openApp } = useLauncher();
  const { preferences, updatePreferences } = usePreferences();

  const apps = useMemo(() => appList.filter((app) => (category === 'All' || app.category === category) && `${app.title} ${app.description}`.toLowerCase().includes(query.toLowerCase())), [query, category]);
  const togglePin = (appId: typeof appList[number]['id']) => {
    const pinned = preferences.dockPinned.includes(appId);
    updatePreferences({ dockPinned: pinned ? preferences.dockPinned.filter((id) => id !== appId) : [...preferences.dockPinned, appId].slice(0, 9) });
  };

  return (
    <div className="app-scroll h-full overflow-y-auto bg-black/5 p-4 sm:p-5">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end"><div className="flex-1"><p className="eyebrow">BUILT-IN COLLECTION</p><h2 className="mt-1.5 text-xl font-semibold tracking-tight text-ink/85">App Center</h2><p className="mt-1 text-[11px] text-ink/35">Everything is already here. No downloads, accounts, or paid APIs.</p></div><label className="relative sm:w-56"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" /><span className="sr-only">Search App Center</span><input className="nova-input !pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find an app" /></label></div>
        <div className="app-scroll mt-5 flex gap-1.5 overflow-x-auto pb-1">{categories.map((item) => <button key={item} className={`shrink-0 rounded-full border px-3 py-1.5 text-[10px] transition-colors ${category === item ? 'border-[rgba(var(--accent-rgb),0.25)] bg-[rgba(var(--accent-rgb),0.1)] accent-text' : 'border-ink/[0.06] text-ink/35 hover:bg-ink/[0.04]'}`} onClick={() => setCategory(item)}>{item}</button>)}</div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">{apps.map((app) => {
          const Icon = app.icon;
          const pinned = preferences.dockPinned.includes(app.id);
          return <article key={app.id} className="nova-card group flex items-start gap-3 p-4 transition-colors hover:border-ink/[0.12]"><span className="accent-surface flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]"><Icon size={21} strokeWidth={1.6} /></span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3 className="truncate text-xs font-semibold text-ink/80">{app.title}</h3><span className="flex items-center gap-1 rounded-full bg-emerald-300/[0.07] px-1.5 py-0.5 text-[8px] text-emerald-200/50"><Check size={8} /> Built-in</span></div><p className="mt-1.5 min-h-8 text-[10px] leading-4 text-ink/35">{app.description}</p><div className="mt-3 flex items-center gap-2"><button className="nova-button h-8 min-h-8 px-3 text-[10px]" onClick={() => openApp(app.id)}>Open</button><button className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-[10px] text-ink/35 transition-colors hover:bg-ink/[0.04] hover:text-ink/60" onClick={() => togglePin(app.id)} aria-pressed={pinned}>{pinned ? <PinOff size={12} /> : <Pin size={12} />}{pinned ? 'Unpin' : 'Pin to dock'}</button></div></div></article>;
        })}</div>
        {!apps.length && <div className="py-16 text-center text-xs text-ink/30">No built-in apps match your search.</div>}
        <p className="mt-5 text-center text-[9px] text-ink/20">App Center manages built-in features only—it does not install executable software.</p>
      </div>
    </div>
  );
}
