import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Check, Database, Download, Gauge, HardDrive, Info, Monitor, Moon,
  Palette, RefreshCw, ShieldCheck, SlidersHorizontal, Sun, Upload, X,
} from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { useLauncher } from '../context/LaunchContext';
import { usePreferences } from '../context/PreferencesContext';
import { MAX_BACKUP_FILE_BYTES, serializeBackup, validateBackup } from '../lib/backup';
import { getDatabaseSnapshot, initializeDatabase, replaceDatabaseSnapshot } from '../lib/db';
import { WELCOME_KEY } from '../lib/preferences';
import { downloadTextFile, errorMessage, formatBytes, toLocalDateKey } from '../lib/utils';
import type { NovaBackup } from '../types';
import { WallpaperPicker } from '../components/WallpaperPicker';
import { useModalFocus } from '../hooks/useModalFocus';
import { createRasterIconDataUrl } from '../lib/image';

type Tab = 'appearance' | 'system' | 'data' | 'about';

function ToggleRow({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: () => void }) {
  return <div className="flex items-center gap-4 py-3"><div className="min-w-0 flex-1"><h4 className="text-xs font-medium text-ink/70">{title}</h4><p className="mt-1 text-[10px] leading-4 text-muted">{description}</p></div><button className={`toggle-switch relative h-6 w-11 shrink-0 rounded-full border transition-colors ${checked ? 'border-[rgba(var(--accent-rgb),0.45)] bg-[rgba(var(--accent-rgb),0.35)]' : 'border-ink/10 bg-ink/[0.06]'}`} role="switch" aria-checked={checked} aria-label={title} onClick={onChange}><span className={`absolute left-[3px] top-[3px] h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-0'}`} /></button></div>;
}

function SettingsCard({ title, children }: { title: string; children: ReactNode }) {
  return <section className="nova-card p-4"><h3 className="text-xs font-semibold text-ink/75">{title}</h3><div className="mt-2 divide-y divide-ink/[0.05]">{children}</div></section>;
}

function SelectRow<T extends string>({ title, description, value, options, onChange }: {
  title: string;
  description: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return <div className="flex items-center gap-4 py-3"><div className="min-w-0 flex-1"><h4 className="text-xs font-medium text-ink/70">{title}</h4><p className="mt-1 text-[10px] leading-4 text-muted">{description}</p></div><select className="nova-input w-32 shrink-0 text-[11px]" aria-label={title} value={value} onChange={(event) => onChange(event.target.value as T)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>;
}

export default function SettingsApp() {
  const [tab, setTab] = useState<Tab>('appearance');
  const [pendingImport, setPendingImport] = useState<NovaBackup | null>(null);
  const [importComplete, setImportComplete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [storageInfo, setStorageInfo] = useState<{ usage: number; quota: number; persisted: boolean } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const cursorInputRef = useRef<HTMLInputElement>(null);
  const [cursorBusy, setCursorBusy] = useState(false);
  const { preferences, updatePreferences, resetPreferences, storageError } = usePreferences();
  const { notify } = useNotifications();
  const { consumeLaunchIntent } = useLauncher();
  const importDialogRef = useModalFocus<HTMLElement>(Boolean(pendingImport), () => setPendingImport(null));

  useEffect(() => {
    const intent = consumeLaunchIntent('settings');
    if (intent?.section) setTab(intent.section);
  }, [consumeLaunchIntent]);

  const refreshStorage = useCallback(async () => {
    try {
      if (!navigator.storage) throw new Error('Storage estimates are not exposed by this browser.');
      const [estimate, persisted] = await Promise.all([
        navigator.storage.estimate(),
        navigator.storage.persisted ? navigator.storage.persisted() : Promise.resolve(false),
      ]);
      setStorageInfo({ usage: estimate.usage ?? 0, quota: estimate.quota ?? 0, persisted });
    } catch (caught) {
      notify({ title: 'Storage details unavailable', message: errorMessage(caught), tone: 'warning' });
    }
  }, [notify]);

  useEffect(() => { if (tab === 'data') void refreshStorage(); }, [tab, refreshStorage]);

  const exportBackup = async () => {
    setBusy(true);
    try {
      await initializeDatabase();
      const snapshot = await getDatabaseSnapshot();
      const backup: NovaBackup = { format: 'nova-web-os-backup', version: 1, exportedAt: new Date().toISOString(), preferences, ...snapshot };
      downloadTextFile(serializeBackup(backup), `nova-backup-${toLocalDateKey(new Date())}.json`);
      notify({ title: 'Backup exported', message: 'Keep the JSON file somewhere safe. It contains your local NOVA data.', tone: 'success' });
    } catch (caught) {
      notify({ title: 'Backup failed', message: errorMessage(caught), tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const readImport = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setImportComplete(false);
    try {
      if (file.size > MAX_BACKUP_FILE_BYTES) throw new Error('Backup files are limited to 64 MB. NOVA exports use this same limit.');
      const parsed: unknown = JSON.parse(await file.text());
      const backup = validateBackup(parsed);
      setPendingImport(backup);
    } catch (caught) {
      setPendingImport(null);
      notify({ title: 'Backup rejected safely', message: caught instanceof SyntaxError ? 'The selected file is not valid JSON.' : errorMessage(caught), tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const applyImport = async () => {
    if (!pendingImport || !window.confirm('Replace the current NOVA data covered by this backup? Older backups without website shortcuts preserve your existing shortcuts. Export a current backup first if needed.')) return;
    setBusy(true);
    try {
      await replaceDatabaseSnapshot(pendingImport);
      const restoredPreferences = pendingImport.preferences.wallpaper === 'custom'
        ? { ...pendingImport.preferences, wallpaper: 'aurora' as const, customWallpaperId: null }
        : pendingImport.preferences;
      updatePreferences(restoredPreferences);
      setPendingImport(null);
      setImportComplete(true);
      window.dispatchEvent(new Event('nova:data-imported'));
      notify({ title: 'Backup imported', message: `Your local NOVA data was replaced with the validated backup.${pendingImport.preferences.wallpaper === 'custom' ? ' The custom wallpaper selection was reset because image data is not included in JSON backups.' : ''}`, tone: 'success' });
      await refreshStorage();
    } catch (caught) {
      notify({ title: 'Import failed without intentional changes', message: errorMessage(caught), tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const uploadCursor = async (file?: File) => {
    if (!file) return;
    setCursorBusy(true);
    try {
      const customCursor = await createRasterIconDataUrl(file, 32);
      updatePreferences({ customCursor, cursorStyle: 'custom' });
      notify({ title: 'NOVA cursor applied', message: 'Your raster cursor was resized and saved locally.', tone: 'success' });
    } catch (caught) {
      notify({ title: 'Cursor not added', message: errorMessage(caught), tone: 'warning' });
    } finally {
      setCursorBusy(false);
    }
  };

  const requestPersistence = async () => {
    try {
      if (!navigator.storage?.persist) throw new Error('Persistent storage requests are not supported by this browser.');
      const granted = await navigator.storage.persist();
      notify({ title: granted ? 'Persistent storage granted' : 'Browser kept automatic storage', message: granted ? 'The browser will try to protect NOVA data from automatic eviction. Site-data deletion can still remove it.' : 'The browser did not grant persistence. Continue to export backups regularly.', tone: granted ? 'success' : 'info' });
      await refreshStorage();
    } catch (caught) {
      notify({ title: 'Persistence request unavailable', message: errorMessage(caught), tone: 'warning' });
    }
  };

  const importCounts = pendingImport ? [
    { label: 'Files', count: pendingImport.files.length },
    { label: 'Notes', count: pendingImport.notes.length },
    { label: 'Events', count: pendingImport.events.length },
    { label: 'History', count: pendingImport.history.length },
    { label: 'Bookmarks', count: pendingImport.bookmarks.length },
    ...(pendingImport.websites ? [{ label: 'Websites', count: pendingImport.websites.length }] : []),
  ] : [];

  const tabs = [
    { id: 'appearance' as const, label: 'Appearance', icon: Palette },
    { id: 'system' as const, label: 'System', icon: SlidersHorizontal },
    { id: 'data' as const, label: 'Data', icon: Database },
    { id: 'about' as const, label: 'About', icon: Info },
  ];

  return (
    <div className="flex h-full bg-black/5">
      <aside className="hidden w-44 shrink-0 flex-col border-r border-ink/[0.06] bg-black/10 p-3 sm:flex"><p className="eyebrow px-2 py-2">CONTROL DECK</p>{tabs.map(({ id, label, icon: Icon }) => <button key={id} className={`mt-1 flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[11px] transition-colors ${tab === id ? 'bg-[rgba(var(--accent-rgb),0.11)] accent-text' : 'text-muted hover:bg-ink/[0.035]'}`} onClick={() => setTab(id)} aria-pressed={tab === id}><Icon size={15} />{label}</button>)}<div className="mt-auto rounded-xl border border-ink/[0.055] p-3"><ShieldCheck size={16} className="text-emerald-300/55" /><p className="mt-2 text-[10px] font-medium text-ink/65">Local by default</p><p className="mt-1 text-[9px] leading-4 text-muted">No account. No backend. No tracking service.</p></div></aside>
      <div className="app-scroll min-w-0 flex-1 overflow-y-auto">
        <nav className="flex gap-1 overflow-x-auto border-b border-ink/[0.06] p-2 sm:hidden" aria-label="Settings sections">{tabs.map(({ id, label }) => <button key={id} className={`shrink-0 rounded-lg px-3 py-2 text-[10px] ${tab === id ? 'bg-ink/[0.07] text-ink/75' : 'text-muted'}`} onClick={() => setTab(id)} aria-pressed={tab === id}>{label}</button>)}</nav>
        <div className="mx-auto max-w-2xl p-4 sm:p-6">
          {storageError && <div className="mb-4 rounded-xl border border-red-300/15 bg-red-300/[0.05] p-3 text-[11px] text-red-200/70" role="alert">{storageError}</div>}

          {tab === 'appearance' && <>
            <p className="eyebrow">PERSONALIZE YOUR ORBIT</p><h2 className="mt-1.5 text-xl font-semibold">Appearance</h2><p className="mt-1.5 text-[11px] text-muted">A few quiet adjustments. Saved automatically in LocalStorage.</p>
            <section className="mt-5"><h3 className="text-xs font-medium text-ink/60">Color mode</h3><div className="mt-2.5 grid grid-cols-2 gap-2">{(['dark', 'light'] as const).map((mode) => <button key={mode} className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-[11px] capitalize ${preferences.colorMode === mode ? 'border-[rgba(var(--accent-rgb),0.4)] bg-[rgba(var(--accent-rgb),0.09)] accent-text' : 'border-ink/[0.07] text-ink/65 hover:bg-ink/[0.03]'}`} onClick={() => updatePreferences({ colorMode: mode })} aria-pressed={preferences.colorMode === mode}>{mode === 'dark' ? <Moon size={15} /> : <Sun size={15} />}{mode} mode</button>)}</div></section>
            <section className="mt-5"><h3 className="text-xs font-medium text-ink/60">Theme</h3><div className="mt-2.5 grid grid-cols-3 gap-2">{([
              ['cosmic', 'Cosmic', 'from-[#111a36] to-[#171229]'], ['midnight', 'Midnight', 'from-[#050810] to-[#0b1320]'], ['nebula', 'Nebula', 'from-[#211238] to-[#11132d]'],
            ] as const).map(([id, label, gradient]) => <button key={id} className={`rounded-xl border p-2 text-left transition-colors ${preferences.theme === id ? 'border-[rgba(var(--accent-rgb),0.45)] bg-[rgba(var(--accent-rgb),0.08)]' : 'border-ink/[0.07] hover:bg-ink/[0.03]'}`} onClick={() => updatePreferences({ theme: id })} aria-pressed={preferences.theme === id}><span className={`block h-14 rounded-lg bg-gradient-to-br ${gradient} shadow-inner`}><span className="m-2 block h-1.5 w-1.5 rounded-full bg-ink/60" /></span><span className="mt-2 flex items-center px-1 text-[10px] text-ink/65">{label}{preferences.theme === id && <Check size={11} className="accent-text ml-auto" />}</span></button>)}</div></section>
            <section className="mt-5"><h3 className="text-xs font-medium text-ink/60">Accent</h3><div className="mt-2.5 flex gap-3">{([['blue', '#63a8ff'], ['violet', '#b39afa'], ['cyan', '#55e6e0']] as const).map(([id, color]) => <button key={id} className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border text-[10px] capitalize ${preferences.accent === id ? 'border-ink/25 bg-ink/[0.06] text-ink/75' : 'border-ink/[0.06] text-muted'}`} onClick={() => updatePreferences({ accent: id })} aria-pressed={preferences.accent === id}><span className="h-3 w-3 rounded-full" style={{ background: color, boxShadow: `0 0 10px ${color}55` }} />{id}</button>)}</div></section>
            <WallpaperPicker />
            <div className="mt-5 space-y-3">
              <SettingsCard title="Window material">
                <ToggleRow title="Window transparency" description="Use layered glass behind desktop windows, or choose a solid window surface." checked={preferences.windowTransparent} onChange={() => updatePreferences({ windowTransparent: !preferences.windowTransparent })} />
                <ToggleRow title="Glass blur" description="Blur content behind glass surfaces. Performance mode always disables blur." checked={preferences.blurEnabled} onChange={() => updatePreferences({ blurEnabled: !preferences.blurEnabled })} />
                <SelectRow title="Glass intensity" description="Adjust surface opacity and blur without changing your theme." value={preferences.glassIntensity} options={[{ value: 'subtle', label: 'Subtle' }, { value: 'balanced', label: 'Balanced' }, { value: 'rich', label: 'Rich' }] as const} onChange={(glassIntensity) => updatePreferences({ glassIntensity })} />
                <SelectRow title="Window corners" description="Choose the corner radius for floating desktop windows." value={preferences.windowRadius} options={[{ value: 'small', label: '10 px' }, { value: 'medium', label: '16 px' }, { value: 'large', label: '22 px' }] as const} onChange={(windowRadius) => updatePreferences({ windowRadius })} />
              </SettingsCard>
              <SettingsCard title="Desktop icons">
                <ToggleRow title="Desktop labels" description="Show app and website names beneath desktop icons. Accessible names remain available." checked={preferences.showDesktopLabels} onChange={() => updatePreferences({ showDesktopLabels: !preferences.showDesktopLabels })} />
                <SelectRow title="Icon size" description="Adjust desktop icon and label sizing." value={preferences.desktopIconSize} options={[{ value: 'small', label: 'Small' }, { value: 'medium', label: 'Medium' }, { value: 'large', label: 'Large' }] as const} onChange={(desktopIconSize) => updatePreferences({ desktopIconSize })} />
                <SelectRow title="Desktop layout" description="Use a single column or a compact multi-column grid on larger screens." value={preferences.desktopLayout} options={[{ value: 'vertical', label: 'Column' }, { value: 'grid', label: 'Grid' }] as const} onChange={(desktopLayout) => updatePreferences({ desktopLayout })} />
              </SettingsCard>
              <SettingsCard title="Taskbar">
                <ToggleRow title="Show clock" description="Show the date and time control in the system tray." checked={preferences.showClock} onChange={() => updatePreferences({ showClock: !preferences.showClock })} />
                <SelectRow title="Taskbar size" description="Automatic adapts to touch input; compact and large use fixed desktop heights." value={preferences.taskbarSize} options={[{ value: 'auto', label: 'Automatic' }, { value: 'compact', label: 'Compact' }, { value: 'large', label: 'Large' }] as const} onChange={(taskbarSize) => updatePreferences({ taskbarSize })} />
                <ToggleRow title="Taskbar transparency" description="Use a glass taskbar or a solid surface. Performance mode remains opaque." checked={preferences.taskbarTransparent} onChange={() => updatePreferences({ taskbarTransparent: !preferences.taskbarTransparent })} />
                <SelectRow title="Taskbar position" description="Place the taskbar above or below the desktop. Phone layouts keep it at the top." value={preferences.taskbarPosition} options={[{ value: 'top', label: 'Top' }, { value: 'bottom', label: 'Bottom' }] as const} onChange={(taskbarPosition) => updatePreferences({ taskbarPosition })} />
              </SettingsCard>
              <SettingsCard title="Cursor">
                <SelectRow title="Cursor style" description="Use the system cursor, NOVA’s static cursor, or your uploaded raster cursor." value={preferences.cursorStyle} options={(preferences.customCursor ? [{ value: 'system', label: 'System' }, { value: 'nova', label: 'NOVA' }, { value: 'custom', label: 'Custom' }] : [{ value: 'system', label: 'System' }, { value: 'nova', label: 'NOVA' }]) as readonly { value: typeof preferences.cursorStyle; label: string }[]} onChange={(cursorStyle) => updatePreferences({ cursorStyle })} />
                <div className="flex items-center gap-3 py-3"><div className="min-w-0 flex-1"><h4 className="text-xs font-medium text-ink/70">Custom raster cursor</h4><p className="mt-1 text-[10px] leading-4 text-muted">PNG or WebP, 512 KB maximum. Re-encoded to a 32 px PNG; SVG is rejected.</p></div>{preferences.customCursor && <img src={preferences.customCursor} alt="Custom cursor preview" className="h-8 w-8 object-contain" />}<button className="nova-button nova-button-secondary h-8 min-h-8 px-2.5 text-[10px]" onClick={() => cursorInputRef.current?.click()} disabled={cursorBusy}>{cursorBusy ? 'Adding…' : 'Upload'}</button><input ref={cursorInputRef} type="file" className="hidden" accept="image/png,image/webp" onChange={(event) => { void uploadCursor(event.target.files?.[0]); event.target.value = ''; }} /></div>
                {preferences.customCursor && <div className="py-2"><button className="text-[10px] text-muted hover:text-ink/70" onClick={() => updatePreferences({ cursorStyle: 'system', customCursor: null })}>Remove custom cursor</button></div>}
              </SettingsCard>
            </div>
          </>}

          {tab === 'system' && <>
            <p className="eyebrow">DESKTOP BEHAVIOR</p><h2 className="mt-1.5 text-xl font-semibold">System preferences</h2><p className="mt-1.5 text-[11px] text-muted">Tune NOVA for comfort or lower-resource hardware.</p>
            <div className="mt-5 space-y-3"><SettingsCard title="Startup"><ToggleRow title="Startup animation" description="Show the polished NOVA logo entrance. Reduced motion always takes priority." checked={preferences.startupAnimation} onChange={() => updatePreferences({ startupAnimation: !preferences.startupAnimation })} /><ToggleRow title="Startup sound" description="Play a short local chime after a click or key press when browser autoplay rules allow it." checked={preferences.startupSound} onChange={() => updatePreferences({ startupSound: !preferences.startupSound })} /></SettingsCard><SettingsCard title="Accessibility & performance"><ToggleRow title="Reduce motion" description="Minimize interface transitions. Your operating system preference is also respected." checked={preferences.reduceMotion} onChange={() => updatePreferences({ reduceMotion: !preferences.reduceMotion })} /><ToggleRow title="Performance mode" description="Use opaque surfaces and disable backdrop blur to reduce GPU compositing." checked={preferences.performanceMode} onChange={() => updatePreferences({ performanceMode: !preferences.performanceMode })} /><ToggleRow title="High contrast" description="Strengthen text, borders, and focus indicators with more opaque surfaces." checked={preferences.highContrast} onChange={() => updatePreferences({ highContrast: !preferences.highContrast })} /><ToggleRow title="Compact window controls" description="Use a slightly tighter title bar layout." checked={preferences.compactMode} onChange={() => updatePreferences({ compactMode: !preferences.compactMode })} /></SettingsCard><SettingsCard title="Desktop"><ToggleRow title="24-hour clock" description="Use 24-hour time in the system tray." checked={preferences.clock24h} onChange={() => updatePreferences({ clock24h: !preferences.clock24h })} /></SettingsCard></div>
            <div className="nova-card mt-4 flex items-center gap-3 p-4"><Gauge size={18} className="accent-text" /><p className="flex-1 text-[10px] leading-5 text-muted">For the Intel i5-3330 / GTX 960 target, Performance mode and reduced motion can lower visual overhead. App code is lazy-loaded and the wallpaper uses static CSS rather than a canvas.</p></div>
            <div className="mt-5 flex flex-wrap gap-2"><button className="nova-button nova-button-secondary" onClick={resetPreferences}><RefreshCw size={14} /> Reset preferences</button><button className="nova-button nova-button-secondary" onClick={() => { try { localStorage.removeItem(WELCOME_KEY); } catch { /* Storage may be blocked. */ } notify({ title: 'Welcome screen reset', message: 'Reload NOVA to see the welcome experience again.', tone: 'success' }); }}><Monitor size={14} /> Show welcome next launch</button></div>
          </>}

          {tab === 'data' && <>
            <p className="eyebrow">LOCAL DATA CONTROL</p><h2 className="mt-1.5 text-xl font-semibold">Storage & backups</h2><p className="mt-1.5 text-[11px] leading-5 text-muted">Export a portable copy or restore a validated NOVA version 1 backup. Exports and imports share a 64 MB safety limit. No file leaves your device unless you download or share it yourself.</p>
            {importComplete && <div className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.05] p-3 text-[11px] text-emerald-100/65"><p>Import complete. Reload to ensure every open app shows the restored data.</p><button className="nova-button mt-3 h-8 min-h-8 text-[10px]" onClick={() => window.location.reload()}>Reload desktop</button></div>}
            <div className="mt-5 grid gap-3 sm:grid-cols-2"><button className="nova-card p-4 text-left transition-colors hover:border-[rgba(var(--accent-rgb),0.2)] hover:bg-ink/[0.04]" onClick={() => void exportBackup()} disabled={busy}><Download size={19} className="accent-text" /><h3 className="mt-3 text-xs font-semibold text-ink/70">Export backup</h3><p className="mt-1.5 text-[10px] leading-4 text-muted">Download files, notes, events, history, bookmarks, and preferences as JSON.</p></button><button className="nova-card p-4 text-left transition-colors hover:border-[rgba(var(--accent-rgb),0.2)] hover:bg-ink/[0.04]" onClick={() => importRef.current?.click()} disabled={busy}><Upload size={19} className="accent-text" /><h3 className="mt-3 text-xs font-semibold text-ink/70">Import backup</h3><p className="mt-1.5 text-[10px] leading-4 text-muted">Validate first, preview counts, then explicitly confirm replacement.</p></button></div>
            <input ref={importRef} type="file" className="hidden" accept=".json,application/json" onChange={(event) => { void readImport(event.target.files?.[0]); event.target.value = ''; }} />
            <section className="nova-card mt-4 p-4"><div className="flex items-center gap-2"><HardDrive size={16} className="accent-text" /><h3 className="text-xs font-semibold text-ink/70">Browser-reported storage</h3><button className="icon-button ml-auto h-7 w-7" onClick={() => void refreshStorage()} aria-label="Refresh storage estimate"><RefreshCw size={13} /></button></div>{storageInfo ? <><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-ink/[0.06]"><div className="h-full rounded-full bg-gradient-to-r from-nova-blue to-nova-violet" style={{ width: `${storageInfo.quota ? Math.max(1, Math.min(100, storageInfo.usage / storageInfo.quota * 100)) : 1}%` }} /></div><div className="mt-2.5 flex justify-between text-[10px] text-muted"><span>{formatBytes(storageInfo.usage)} used by this origin (estimate)</span><span>{formatBytes(storageInfo.quota)} available quota</span></div><p className="mt-3 text-[10px] text-muted">Persistent storage: <span className={storageInfo.persisted ? 'text-emerald-300/70' : 'text-amber-300/70'}>{storageInfo.persisted ? 'granted' : 'not granted'}</span></p></> : <p className="mt-3 text-[10px] text-muted">Storage estimate is loading or unavailable.</p>}<button className="nova-button nova-button-secondary mt-4 h-8 min-h-8 text-[10px]" onClick={() => void requestPersistence()}>Request persistent storage</button><p className="mt-2 text-[9px] leading-4 text-muted">The browser decides whether to grant this. It does not prevent manual site-data deletion or replace backups.</p></section>
            <div className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[0.035] p-3.5 text-[10px] leading-5 text-amber-100/40"><strong className="text-amber-100/65">Privacy note:</strong> backups are unencrypted JSON and can contain personal notes, events, file contents, and browsing addresses. Store them carefully.</div>
          </>}

          {tab === 'about' && <>
            <p className="eyebrow">BEYOND EARTH. BEYOND LIMITS.</p><h2 className="mt-1.5 text-xl font-semibold">About NOVA Web OS</h2><p className="mt-3 text-xs leading-6 text-muted">NOVA is a lightweight, local-first desktop environment built with React, TypeScript, Vite, Tailwind CSS, Lucide, and selectively used Framer Motion.</p>
            <div className="mt-5 grid grid-cols-2 gap-3"><div className="nova-card p-4"><p className="text-[9px] uppercase tracking-wider text-muted">Version</p><p className="mt-2 text-sm font-medium text-ink/70">1.0.0</p></div><div className="nova-card p-4"><p className="text-[9px] uppercase tracking-wider text-muted">Architecture</p><p className="mt-2 text-sm font-medium text-ink/70">100% client-side</p></div></div>
            <SettingsCard title="Honest environment information"><div className="py-3 text-[11px] leading-5 text-muted"><p>Browser-reported logical CPU threads: <span className="text-ink/60">{navigator.hardwareConcurrency || 'not exposed'}</span></p><p className="mt-2">Quick Settings CPU, RAM, and GPU figures are <span className="text-amber-200/70">simulated</span>. NOVA does not read genuine Windows Task Manager statistics, GPU load, or physical RAM use.</p></div></SettingsCard>
            <div className="nova-card mt-4 p-4"><div className="flex items-center gap-2"><Moon size={15} className="accent-text" /><h3 className="text-xs font-semibold text-ink/70">Browser—not a real OS installation</h3></div><p className="mt-2 text-[10px] leading-5 text-muted">NOVA does not install an operating system, access the bootloader or BIOS, alter partitions, or bypass browser/Windows security. Its file system, terminal, and performance widget are intentionally limited simulations or browser-safe interfaces.</p></div>
            <p className="mt-6 text-center text-[10px] text-muted">Designed for modern browsers on Windows 10, Android, iOS, and other responsive screens.</p>
          </>}
        </div>
      </div>

      {pendingImport && <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 p-4" onClick={() => setPendingImport(null)}><section ref={importDialogRef} tabIndex={-1} className="glass-panel app-scroll max-h-full w-full max-w-md overflow-y-auto p-5" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Import preview"><div className="flex items-center"><div className="flex-1"><p className="eyebrow">VALIDATED BACKUP</p><h3 className="mt-1 text-base font-semibold">Review import</h3></div><button className="icon-button" onClick={() => setPendingImport(null)} aria-label="Cancel import"><X size={16} /></button></div><p className="mt-3 text-[11px] leading-5 text-muted">The file passed schema and safety checks. Importing will replace current NOVA structured data and preferences.</p><div className="mt-4 grid grid-cols-3 gap-2 text-center sm:grid-cols-5">{importCounts.map(({ label, count }) => <div key={label} className="rounded-lg bg-ink/[0.035] p-2.5"><p className="text-sm font-semibold text-ink/70">{count}</p><p className="mt-1 text-[9px] text-muted">{label}</p></div>)}</div><p className="mt-4 text-[9px] text-muted">Exported {new Date(pendingImport.exportedAt).toLocaleString()}</p><div className="mt-5 flex flex-wrap justify-end gap-2"><button className="nova-button nova-button-secondary" onClick={() => setPendingImport(null)}>Cancel</button><button className="nova-button" onClick={() => void applyImport()} disabled={busy}>Replace local data</button></div></section></div>}
    </div>
  );
}
