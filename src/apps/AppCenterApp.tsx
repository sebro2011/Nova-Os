import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Check, Globe2, LayoutGrid, Library, Monitor, MonitorOff, Pencil, Pin, PinOff, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import { appList, type AppDefinition } from './registry';
import { useLauncher } from '../context/LaunchContext';
import { usePreferences } from '../context/PreferencesContext';
import { useNotifications } from '../context/NotificationContext';
import { notifyWebsitesChanged, useWebsiteShortcuts } from '../hooks/useWebsiteShortcuts';
import { deleteRecord, putRecord } from '../lib/db';
import { displayUrl } from '../lib/browser';
import { createRasterIconDataUrl } from '../lib/image';
import { createId, errorMessage } from '../lib/utils';
import { MAX_WEBSITE_SHORTCUTS, normalizeWebsiteName, normalizeWebsiteUrl } from '../lib/websites';
import type { AppId, WebsiteShortcut } from '../types';
import { WebsiteIcon } from '../components/WebsiteIcon';

const categories = ['All', 'Productivity', 'System', 'Internet', 'Media'] as const;
const coreApps = new Set<AppId>(['settings', 'app-center', 'browser', 'task-manager']);
const sections = [
  { id: 'discover', label: 'Discover' },
  { id: 'apps', label: 'NOVA Apps' },
  { id: 'installed', label: 'Installed' },
  { id: 'library', label: 'Library' },
  { id: 'add-website', label: 'Add Website' },
] as const;
type Section = typeof sections[number]['id'];

const emptyForm = { name: '', url: '', icon: null as string | null, showOnDesktop: true };

function AppCard({ app, installed, pinned, onOpen, onInstall, onPin }: {
  app: AppDefinition;
  installed: boolean;
  pinned: boolean;
  onOpen: () => void;
  onInstall: () => void;
  onPin: () => void;
}) {
  const Icon = app.icon;
  const core = coreApps.has(app.id);
  return <article className="nova-card flex h-full items-start gap-3 p-4">
    <span className="accent-surface flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]"><Icon size={21} strokeWidth={1.6} /></span>
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-xs font-semibold text-ink/80">{app.title}</h3><span className={`rounded-full px-1.5 py-0.5 text-[8px] ${installed ? 'bg-emerald-300/[0.07] text-emerald-200/60' : 'bg-ink/[0.05] text-muted'}`}>{installed ? 'Installed' : 'Removed'}</span></div>
      <p className="mt-1.5 min-h-8 text-[10px] leading-4 text-muted">{app.description}</p>
      <p className="mt-1 text-[9px] text-muted">{app.category}{core ? ' · Core app' : ' · Data is retained if removed'}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {installed ? <button className="nova-button h-8 min-h-8 px-3 text-[10px]" onClick={onOpen}>Open</button> : <button className="nova-button h-8 min-h-8 px-3 text-[10px]" onClick={onInstall}><RotateCcw size={12} />Restore</button>}
        {installed && !core && <button className="h-8 rounded-lg px-2 text-[10px] text-muted hover:bg-ink/[0.04] hover:text-ink/70" onClick={onInstall}>Remove</button>}
        {app.id === 'app-center' ? <span className="flex h-8 items-center px-2 text-[10px] text-muted">Available in launcher</span> : installed && <button className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-[10px] text-muted transition-colors hover:bg-ink/[0.04] hover:text-ink/70" onClick={onPin} aria-pressed={pinned}>{pinned ? <PinOff size={12} /> : <Pin size={12} />}{pinned ? 'Unpin' : 'Pin to dock'}</button>}
      </div>
    </div>
  </article>;
}

export default function AppCenterApp() {
  const [section, setSection] = useState<Section>('discover');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<typeof categories[number]>('All');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [iconBusy, setIconBusy] = useState(false);
  const iconInputRef = useRef<HTMLInputElement>(null);
  const { openApp } = useLauncher();
  const { preferences, updatePreferences } = usePreferences();
  const { notify } = useNotifications();
  const { websites, loading, error } = useWebsiteShortcuts();

  const installedApps = (app: AppDefinition) => !preferences.removedApps.includes(app.id);
  const visibleApps = useMemo(() => appList.filter((app) => {
    if (section === 'installed' && !installedApps(app)) return false;
    if (section === 'discover' && !installedApps(app)) return false;
    return (category === 'All' || app.category === category) && `${app.title} ${app.description}`.toLowerCase().includes(query.trim().toLowerCase());
  }), [section, category, query, preferences.removedApps]);
  const discoverApps = section === 'discover' ? visibleApps.filter((app) => ['files', 'browser', 'notes', 'media', 'task-manager'].includes(app.id)).slice(0, 5) : visibleApps;
  const filteredWebsites = useMemo(() => websites.filter((website) => `${website.name} ${website.url}`.toLowerCase().includes(query.trim().toLowerCase())), [websites, query]);

  const togglePin = (appId: AppId) => {
    if (appId === 'app-center') return;
    const pinned = preferences.dockPinned.includes(appId);
    if (!pinned && preferences.dockPinned.length >= 9) {
      notify({ title: 'Dock is full', message: 'Unpin an app before adding another. Your existing pins were not changed.', tone: 'info' });
      return;
    }
    updatePreferences({ dockPinned: pinned ? preferences.dockPinned.filter((id) => id !== appId) : [...preferences.dockPinned, appId] });
  };

  const toggleInstalled = (appId: AppId) => {
    if (coreApps.has(appId) && preferences.removedApps.includes(appId)) {
      updatePreferences({ removedApps: preferences.removedApps.filter((id) => id !== appId) });
      return;
    }
    if (coreApps.has(appId)) return;
    const removed = preferences.removedApps.includes(appId);
    updatePreferences({ removedApps: removed ? preferences.removedApps.filter((id) => id !== appId) : [...preferences.removedApps, appId] });
    notify({
      title: removed ? `${appList.find((app) => app.id === appId)?.title} restored` : `${appList.find((app) => app.id === appId)?.title} removed from launchers`,
      message: 'Application data was not deleted. Restoring is available in NOVA Apps.',
      tone: 'success',
    });
  };

  const appCard = (app: AppDefinition) => <AppCard
    key={app.id}
    app={app}
    installed={installedApps(app)}
    pinned={preferences.dockPinned.includes(app.id)}
    onOpen={() => openApp(app.id)}
    onInstall={() => toggleInstalled(app.id)}
    onPin={() => togglePin(app.id)}
  />;

  const editWebsite = (website: WebsiteShortcut) => {
    setEditingId(website.id);
    setForm({ name: website.name, url: website.url, icon: website.icon, showOnDesktop: website.showOnDesktop });
    setFormError('');
    setSection('add-website');
  };

  const saveWebsite = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    try {
      const existing = websites.find((website) => website.id === editingId);
      if (!existing && websites.length >= MAX_WEBSITE_SHORTCUTS) throw new Error(`NOVA supports up to ${MAX_WEBSITE_SHORTCUTS} website shortcuts.`);
      const website: WebsiteShortcut = {
        id: existing?.id ?? createId('website'),
        name: normalizeWebsiteName(form.name),
        url: normalizeWebsiteUrl(form.url),
        icon: form.icon,
        showOnDesktop: form.showOnDesktop,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      };
      await putRecord('websites', website);
      notifyWebsitesChanged();
      setForm(emptyForm);
      setEditingId(null);
      setSection('library');
      notify({ title: existing ? 'Website shortcut updated' : 'Website added to NOVA', message: `${website.name} will open through NOVA Browser’s embedding safeguards.`, tone: 'success' });
    } catch (caught) {
      setFormError(errorMessage(caught));
    }
  };

  const uploadIcon = async (file?: File) => {
    if (!file) return;
    setIconBusy(true);
    setFormError('');
    try {
      const icon = await createRasterIconDataUrl(file, 64);
      setForm((current) => ({ ...current, icon }));
    } catch (caught) {
      setFormError(errorMessage(caught));
    } finally {
      setIconBusy(false);
    }
  };

  const toggleWebsiteDesktop = async (website: WebsiteShortcut) => {
    try {
      await putRecord('websites', { ...website, showOnDesktop: !website.showOnDesktop });
      notifyWebsitesChanged();
    } catch (caught) {
      notify({ title: 'Desktop shortcut not changed', message: errorMessage(caught), tone: 'error' });
    }
  };

  const removeWebsite = async (website: WebsiteShortcut) => {
    if (!window.confirm(`Remove website shortcut “${website.name}”? NOVA Browser history and bookmarks will not be deleted.`)) return;
    try {
      await deleteRecord('websites', website.id);
      notifyWebsitesChanged();
      if (editingId === website.id) { setEditingId(null); setForm(emptyForm); }
      notify({ title: 'Website shortcut removed', message: 'Browser history and bookmarks were not changed.', tone: 'success' });
    } catch (caught) {
      notify({ title: 'Website not removed', message: errorMessage(caught), tone: 'error' });
    }
  };

  return (
    <div className="app-scroll h-full overflow-y-auto bg-black/5 p-4 sm:p-5">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end"><div className="flex-1"><p className="eyebrow">CONTROLLED APP COLLECTION</p><h2 className="mt-1.5 text-xl font-semibold tracking-tight text-ink/85">App Center</h2><p className="mt-1 text-[11px] text-muted">Built-in NOVA apps and your safe website shortcuts. No executable downloads.</p></div>{section !== 'add-website' && <label className="relative sm:w-56"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><span className="sr-only">Search App Center</span><input className="nova-input !pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your collection" /></label>}</div>
        <nav className="app-scroll mt-5 flex gap-1.5 overflow-x-auto pb-1" aria-label="App Center sections">{sections.map((item) => <button key={item.id} className={`shrink-0 rounded-full border px-3 py-1.5 text-[10px] transition-colors ${section === item.id ? 'border-[rgba(var(--accent-rgb),0.25)] bg-[rgba(var(--accent-rgb),0.1)] accent-text' : 'border-ink/[0.06] text-muted hover:bg-ink/[0.04]'}`} onClick={() => { setSection(item.id); setFormError(''); if (item.id !== 'add-website') { setEditingId(null); setForm(emptyForm); } }} aria-pressed={section === item.id}>{item.id === 'add-website' ? <Plus size={11} className="mr-1 inline" /> : null}{item.label}</button>)}</nav>

        {(section === 'apps' || section === 'installed') && <div className="app-scroll mt-4 flex gap-1.5 overflow-x-auto pb-1" aria-label="App categories">{categories.map((item) => <button key={item} className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] ${category === item ? 'bg-ink/[0.08] text-ink/75' : 'text-muted hover:bg-ink/[0.04]'}`} onClick={() => setCategory(item)} aria-pressed={category === item}>{item}</button>)}</div>}

        {(section === 'discover' || section === 'apps' || section === 'installed') && <section className="mt-4">
          {section === 'discover' && <div className="glass-subtle mb-4 flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center"><span className="accent-surface flex h-11 w-11 items-center justify-center rounded-[14px]"><LayoutGrid size={21} /></span><div className="flex-1"><h3 className="text-xs font-semibold text-ink/80">Your local universe, organized</h3><p className="mt-1 text-[10px] leading-4 text-muted">Restore built-ins without losing data, or turn trusted websites into desktop shortcuts.</p></div><button className="nova-button nova-button-secondary h-8 min-h-8 text-[10px]" onClick={() => setSection('add-website')}><Plus size={12} />Add website</button></div>}
          <div className="flex items-center gap-2"><h3 className="text-xs font-semibold text-ink/70">{section === 'discover' ? 'Featured for you' : section === 'installed' ? 'Installed NOVA apps' : 'NOVA app catalog'}</h3><span className="text-[9px] text-muted">{discoverApps.length}</span></div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">{discoverApps.map(appCard)}</div>
          {!discoverApps.length && <div className="py-16 text-center text-xs text-muted">No apps match this view.</div>}
          {section === 'discover' && filteredWebsites.length > 0 && <div className="mt-6"><div className="flex items-center gap-2"><Library size={14} className="accent-text" /><h3 className="text-xs font-semibold text-ink/70">From your library</h3></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{filteredWebsites.slice(0, 4).map((website) => <button key={website.id} className="nova-card flex items-center gap-3 p-3 text-left hover:bg-ink/[0.04]" onClick={() => openApp('browser', { url: website.url })}><span className="accent-surface flex h-9 w-9 items-center justify-center rounded-xl"><WebsiteIcon website={website} size={18} /></span><span className="min-w-0"><span className="block truncate text-xs text-ink/75">{website.name}</span><span className="mt-1 block truncate text-[9px] text-muted">{displayUrl(website.url)}</span></span></button>)}</div></div>}
        </section>}

        {section === 'library' && <section className="mt-4"><div className="flex items-center gap-3"><div className="flex-1"><h3 className="text-xs font-semibold text-ink/70">Website library</h3><p className="mt-1 text-[10px] text-muted">{websites.length} of {MAX_WEBSITE_SHORTCUTS} shortcuts · Browser history and bookmarks are separate.</p></div><button className="nova-button h-8 min-h-8 text-[10px]" onClick={() => setSection('add-website')}><Plus size={12} />Add website</button></div>
          {error && <p className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-3 text-[10px] text-amber-100/60" role="alert">{error}</p>}
          <div className="mt-4 grid gap-3 md:grid-cols-2">{filteredWebsites.map((website) => <article key={website.id} className="nova-card p-4"><div className="flex items-start gap-3"><span className="accent-surface flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]"><WebsiteIcon website={website} size={23} /></span><div className="min-w-0 flex-1"><h3 className="truncate text-xs font-semibold text-ink/80">{website.name}</h3><p className="mt-1 truncate text-[9px] text-muted" title={website.url}>{displayUrl(website.url)}</p><p className="mt-2 text-[9px] text-muted">{website.showOnDesktop ? 'On desktop' : 'Library only'}</p></div></div><div className="mt-3 flex flex-wrap gap-1.5"><button className="nova-button h-8 min-h-8 px-3 text-[10px]" onClick={() => openApp('browser', { url: website.url })}>Open</button><button className="icon-button h-8 w-8" onClick={() => void toggleWebsiteDesktop(website)} aria-label={website.showOnDesktop ? `Remove ${website.name} from desktop` : `Show ${website.name} on desktop`} aria-pressed={website.showOnDesktop}>{website.showOnDesktop ? <MonitorOff size={13} /> : <Monitor size={13} />}</button><button className="icon-button h-8 w-8" onClick={() => editWebsite(website)} aria-label={`Edit ${website.name}`}><Pencil size={13} /></button><button className="icon-button h-8 w-8 hover:!bg-red-400/15" onClick={() => void removeWebsite(website)} aria-label={`Remove ${website.name}`}><Trash2 size={13} /></button></div></article>)}</div>
          {!loading && !filteredWebsites.length && <div className="py-16 text-center"><Globe2 size={25} className="mx-auto text-ink/20" /><p className="mt-3 text-xs text-muted">{query ? 'No websites match your search.' : 'Your website library is ready for its first shortcut.'}</p>{!query && <button className="nova-button nova-button-secondary mt-4" onClick={() => setSection('add-website')}>Add your first website</button>}</div>}
        </section>}

        {section === 'add-website' && <section className="mx-auto mt-5 max-w-xl"><p className="eyebrow">{editingId ? 'EDIT SHORTCUT' : 'NEW SHORTCUT'}</p><h3 className="mt-1 text-base font-semibold">{editingId ? 'Edit website' : 'Add a website to NOVA'}</h3><p className="mt-2 text-[10px] leading-5 text-muted">NOVA stores only the name, validated address, optional raster icon, and desktop preference. Sites open inside NOVA Browser when permitted, with an external-opening fallback when blocked.</p>
          <form className="nova-card mt-4 space-y-4 p-4" onSubmit={(event) => void saveWebsite(event)}>
            <label className="block"><span className="mb-1.5 block text-[10px] font-medium text-ink/65">Website name</span><input className="nova-input" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} maxLength={80} required placeholder="Example" /></label>
            <label className="block"><span className="mb-1.5 block text-[10px] font-medium text-ink/65">Website URL</span><input className="nova-input" value={form.url} onChange={(event) => setForm((current) => ({ ...current, url: event.target.value }))} required inputMode="url" autoCapitalize="off" autoComplete="off" spellCheck={false} placeholder="https://example.com" /></label>
            <div className="flex items-center gap-3"><span className="accent-surface flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px]"><WebsiteIcon website={form} size={25} /></span><div className="min-w-0 flex-1"><p className="text-[10px] font-medium text-ink/65">Optional icon</p><p className="mt-1 text-[9px] leading-4 text-muted">PNG/WebP up to 512 KB, resized to 64 px. No remote favicon tracking.</p></div><button type="button" className="nova-button nova-button-secondary h-8 min-h-8 px-2.5 text-[10px]" onClick={() => iconInputRef.current?.click()} disabled={iconBusy}>{iconBusy ? 'Processing…' : 'Upload'}</button><input ref={iconInputRef} type="file" className="hidden" accept="image/png,image/webp" onChange={(event) => { void uploadIcon(event.target.files?.[0]); event.target.value = ''; }} /></div>
            {form.icon && <button type="button" className="text-[10px] text-muted hover:text-ink/70" onClick={() => setForm((current) => ({ ...current, icon: null }))}>Use letter icon instead</button>}
            <label className="flex items-center gap-2.5 text-[11px] text-ink/65"><input type="checkbox" className="range-accent h-4 w-4" checked={form.showOnDesktop} onChange={(event) => setForm((current) => ({ ...current, showOnDesktop: event.target.checked }))} />Show on desktop</label>
            {formError && <p className="rounded-lg border border-red-300/15 bg-red-300/[0.05] p-2.5 text-[10px] text-red-200/70" role="alert">{formError}</p>}
            <div className="flex justify-end gap-2"><button type="button" className="nova-button nova-button-secondary" onClick={() => { setSection('library'); setEditingId(null); setForm(emptyForm); setFormError(''); }}>Cancel</button><button className="nova-button" type="submit"><Check size={14} />{editingId ? 'Save changes' : 'Add website'}</button></div>
          </form>
        </section>}
        <p className="mt-6 text-center text-[9px] leading-4 text-muted">App Center manages NOVA’s controlled registry and validated shortcuts only. Removing a built-in app never erases its notes, files, events, or other data.</p>
      </div>
    </div>
  );
}
