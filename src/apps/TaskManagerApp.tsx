import { useMemo } from 'react';
import { Activity, ExternalLink, Info, Minus, X } from 'lucide-react';
import { appRegistry } from './registry';
import { useWindowControls } from '../context/WindowManagerContext';

export default function TaskManagerApp() {
  const { windows, focusWindow, minimizeWindow, closeWindow } = useWindowControls();
  const orderedWindows = useMemo(() => [...windows].sort((a, b) => Number(a.minimized) - Number(b.minimized) || b.zIndex - a.zIndex), [windows]);
  const activeId = windows.filter((item) => !item.minimized).sort((a, b) => b.zIndex - a.zIndex)[0]?.id;
  const minimizedCount = windows.filter((item) => item.minimized).length;
  const visibleCount = windows.length - minimizedCount;

  return (
    <div className="app-scroll h-full overflow-y-auto bg-black/5 p-4 sm:p-5">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-start gap-3"><span className="accent-surface flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]"><Activity size={21} /></span><div><p className="eyebrow">LIVE NOVA WINDOW MANAGER</p><h2 className="mt-1.5 text-xl font-semibold tracking-tight text-ink/85">Task Manager</h2><p className="mt-1 text-[11px] text-muted">Real application windows in this NOVA session—not operating-system processes.</p></div></div>

        <div className="mt-5 grid grid-cols-3 gap-2" aria-label="Window summary">
          {[{ label: 'Total windows', value: windows.length }, { label: 'Visible', value: visibleCount }, { label: 'Minimized', value: minimizedCount }].map((item) => <div key={item.label} className="nova-card p-3 text-center"><p className="text-lg font-semibold tabular-nums text-ink/80">{item.value}</p><p className="mt-1 text-[9px] text-muted">{item.label}</p></div>)}
        </div>

        <section className="mt-5" aria-labelledby="running-windows-title"><div className="flex items-center gap-2"><h3 id="running-windows-title" className="text-xs font-semibold text-ink/75">NOVA windows</h3><span className="rounded-full bg-ink/[0.05] px-2 py-0.5 text-[9px] text-muted">Updates automatically</span></div>
          <div className="mt-3 space-y-2">{orderedWindows.map((item) => {
            const app = appRegistry[item.appId];
            const Icon = app.icon;
            const status = item.minimized ? 'Minimized' : item.id === activeId ? 'Active' : 'Running';
            return <article key={item.id} className="nova-card flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center" data-window-status={status.toLowerCase()}>
              <span className="accent-surface flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"><Icon size={19} /></span>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h4 className="truncate text-xs font-semibold text-ink/80">{app.title}</h4><span className={`rounded-full px-2 py-0.5 text-[8px] ${item.minimized ? 'bg-amber-300/[0.07] text-amber-100/60' : item.id === activeId ? 'bg-emerald-300/[0.08] text-emerald-200/70' : 'bg-ink/[0.05] text-muted'}`}>{status}</span></div><p className="mt-1.5 text-[9px] text-muted">{item.appId === 'task-manager' ? 'This Task Manager window' : app.category}{item.maximized ? ' · Maximized' : item.snapped ? ` · Snapped ${item.snapped}` : ''}</p></div>
              <div className="flex flex-wrap gap-1.5">
                <button className="nova-button h-8 min-h-8 px-2.5 text-[10px]" onClick={() => focusWindow(item.id)} aria-label={`${item.minimized ? 'Restore' : 'Focus'} ${app.title}`}><ExternalLink size={12} />{item.minimized ? 'Restore' : 'Focus'}</button>
                <button className="icon-button h-8 w-8" onClick={() => minimizeWindow(item.id)} disabled={item.minimized} aria-label={`Minimize ${app.title}`} title={item.minimized ? 'Already minimized' : 'Minimize window'}><Minus size={13} /></button>
                <button className="icon-button h-8 w-8 hover:!bg-red-400/15" onClick={() => closeWindow(item.id)} aria-label={`Close ${app.title} window`} title="Close window; apps with unsaved changes may ask first"><X size={13} /></button>
              </div>
            </article>;
          })}</div>
          {!orderedWindows.length && <p className="py-14 text-center text-xs text-muted">No NOVA windows are running.</p>}
        </section>

        <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-ink/[0.06] bg-ink/[0.025] p-3 text-[10px] leading-5 text-muted"><Info size={14} className="mt-0.5 shrink-0 accent-text" /><p><span className="font-medium text-ink/65">Browser security boundary:</span> NOVA cannot inspect per-app CPU, full system RAM, GPU load, other browser tabs, or native processes. Those values are intentionally not shown. Closing a window uses NOVA’s normal close guards and does not erase application data.</p></div>
      </div>
    </div>
  );
}
